require('dotenv').config();
const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { readFileSync } = require('fs');
const os = require('os');
const qrcode = require('qrcode-terminal');

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

// Store all active games, keyed by game code
const games = {};

let systemPrompt = "oot ai tai jotain"; // Default prompt

try {
    systemPrompt = readFileSync('systemPrompt.txt', 'utf-8');
} catch (err) {
    console.error('Error reading system prompt:', err);
}

// Generate a random 4-character game code
function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (games[code]); // Ensure unique
    return code;
}

// Create a new game with initial state
function createGame(gameCode) {
    games[gameCode] = {
        // Player management
        users: [],                      // Players not yet ready
        allUsers: [],                   // All joined players (ordered)
        usersRemaining: [],             // Players still active this round
        clients: new Set(),             // WebSocket connections for this game

        // Scoring
        userScores: new Map(),          // Permanent scores
        userScoresOnHand: new Map(),    // Temporary round scores

        // Game state
        turn: '',
        questionCount: 10,
        everyoneIn: false,

        // Voting
        votes: 0,
        voteCount: 0,

        // Content
        questionTopics: ['mitä vaan'],
        cachedQuestion: null,

        // question type (1-5)
        questionType: 1,
        // active question type (the type of the question currently being played)
        orderQuestionNext: false,
        orderQuestionNow: false,

        // 1-10 question options answered
        orderQuestionAnswered: [],

        // Game status
        status: 'lobby'  // 'lobby', 'playing', 'ended'
    };

    // Pre-fetch a question for this game
    fetchAndCacheQuestion(gameCode);

    return games[gameCode];
}

// Function to get local IP address
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost';
}

// Function to generate a new question from the API
async function generateQuestion(gameCode) {
    const game = games[gameCode];
    if (!game) return null;

    if (game.questionTopics.length === 0) {
        console.log(`[${gameCode}] No topics available yet!`);
        return null;
    }

    const topic = game.questionTopics[Math.floor(Math.random() * game.questionTopics.length)];
    game.questionType = Math.floor(Math.random() * 5) + 1;
    if (game.questionType == 3) {
        game.orderQuestionNext = true;
    }
    else {
        game.orderQuestionNext = false;
    }
    console.log(`[${gameCode}] Selected topic:`, topic);
    console.log(`[${gameCode}] Selected question type:`, game.questionType);

    const prompt = `${systemPrompt}\n\n${topic}\n${game.questionType}`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 1.2,
            topK: 40,
            topP: 0.95,
        },
    });

    const response = result.response;
    let question = response.text();
    question = question.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return question;
}

// Function to fetch and cache a new question in the background
async function fetchAndCacheQuestion(gameCode) {
    const game = games[gameCode];
    if (!game) return;

    try {
        game.cachedQuestion = await generateQuestion(gameCode);
        console.log(`[${gameCode}] Question cached and ready!`);
    } catch (error) {
        console.error(`[${gameCode}] Error fetching question:`, error);
    }
}

// Function to get the cached question
function getQuestion(gameCode) {
    const game = games[gameCode];
    return game ? game.cachedQuestion : null;
}

function getTurn(gameCode) {
    const game = games[gameCode];
    if (!game) return '';

    console.log(`[${gameCode}] remainingUsers:`, game.usersRemaining);
    console.log(`[${gameCode}] previous turn:`, game.turn);
    let prevIndex = game.allUsers.indexOf(game.turn);

    if (!game.usersRemaining.includes(game.turn) || (game.questionCount == 10 && game.usersRemaining.length == game.allUsers.length)) {
        for (let i = 1; i <= game.allUsers.length; i++) {
            let nextIndex = (prevIndex + i) % game.allUsers.length;
            let nextPlayer = game.allUsers[nextIndex];

            if (game.usersRemaining.includes(nextPlayer)) {
                game.turn = nextPlayer;
                console.log(`[${gameCode}] Next turn (after player removed):`, game.turn);
                return game.turn;
            }
        }
    } else {
        let currentIndexInRemaining = game.usersRemaining.indexOf(game.turn);
        let nextIndex = (currentIndexInRemaining + 1) % game.usersRemaining.length;
        game.turn = game.usersRemaining[nextIndex];
        console.log(`[${gameCode}] Current turn:`, game.turn);
        return game.turn;
    }

    return game.turn;
}

function add1PointOnHand(gameCode, username) {
    const game = games[gameCode];
    if (!game) return;

    let currentScore = game.userScoresOnHand.get(username) || 0;
    game.userScoresOnHand.set(username, currentScore + 1);
    console.log(`[${gameCode}] ${username} now has ${currentScore + 1} points on hand`);
}

function deleteHand(gameCode, username) {
    const game = games[gameCode];
    if (!game) return;

    game.userScoresOnHand.set(username, 0);
}

function addHandToScore(gameCode, username) {
    const game = games[gameCode];
    if (!game) return;

    let currentScore = game.userScores.get(username) || 0;
    let currentScoreOnHand = game.userScoresOnHand.get(username) || 0;
    let newScore = currentScore + currentScoreOnHand;
    game.userScores.set(username, newScore);
    game.userScoresOnHand.set(username, 0);
    console.log(`[${gameCode}] ${username} now has ${newScore} points`);
}

function userReady(gameCode, username) {
    const game = games[gameCode];
    if (!game) return false;

    const index = game.users.indexOf(username);
    if (index > -1) {
        game.users.splice(index, 1);
        if (game.users.length == 0) {
            game.everyoneIn = true;
            game.status = 'playing';
            return true;
        }
    }
    return false;
}

// Broadcast message to all clients in a specific game
function broadcastToGame(gameCode, data) {
    const game = games[gameCode];
    if (!game) return;

    const message = JSON.stringify(data);
    game.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// Create WebSocket server
const PORT = process.env.PORT || 7654;
const wss = new WebSocketServer({
    port: PORT,
    host: '0.0.0.0'
});

console.log(`WebSocket server running on port ${PORT}`);

// Only show QR code in development
if (process.env.NODE_ENV !== 'production') {
    const localIP = getLocalIPAddress();
    const frontendURL = `http://${localIP}:5173`;
    console.log(`\n${frontendURL}\n`);
    qrcode.generate(frontendURL, { small: true });
}

wss.on('connection', (ws) => {
    console.log('New client connected!');
    let clientUsername = 'Anonymous';
    let clientGameCode = null;

    ws.on('message', async (data) => {

        function voting(gameCode, username, vote) {
            const game = games[gameCode];
            if (!game) return;

            let playerCount = game.userScores.size - 1;
            game.votes += vote;
            game.voteCount++;

            console.log(`[${gameCode}] playerCount:`, playerCount);
            console.log(`[${gameCode}] voteCount:`, game.voteCount);
            console.log(`[${gameCode}] votes:`, game.votes);

            if (game.voteCount == playerCount) {
                console.log(`[${gameCode}] everyone voted`);

                if (game.votes >= 0) {
                    add1PointOnHand(gameCode, username);
                } else {
                    game.usersRemaining.splice(game.usersRemaining.indexOf(username), 1);
                    console.log(`[${gameCode}] user removed from remaining users`);
                    console.log(`[${gameCode}]`, game.usersRemaining);
                    deleteHand(gameCode, username);
                }

                game.votes = 0;
                game.voteCount = 0;
                let newScore = game.userScores.get(username);
                newScore = `${newScore} + ${game.userScoresOnHand.get(username)}`;
                console.log(`[${gameCode}] new score of ${username} is: ${newScore}`);
                game.questionCount--;
                console.log(`[${gameCode}] questionCount:`, game.questionCount);

                if (game.questionCount == 0 || game.usersRemaining.length == 0) {
                    endOfRound(gameCode);
                } else {
                    const nextTurn = getTurn(gameCode);
                    broadcastToGame(gameCode, {
                        type: 'voting-result',
                        username: username,
                        score: newScore,
                        nextTurn: nextTurn
                    });
                }
            }
        }

        async function questionRequested(gameCode) {
            const game = games[gameCode];
            if (!game) return;

            console.log(`[${gameCode}] New question requested`);
            let newQ = getQuestion(gameCode);

            // If no cached question yet, wait for it to be generated
            if (!newQ) {
                console.log(`[${gameCode}] No cached question yet, waiting for generation...`);
                await fetchAndCacheQuestion(gameCode);
                newQ = getQuestion(gameCode);
            }

            // Snapshot the active question type before the next fetch overwrites it
            game.activeQuestionType = game.questionType;
            const nextTurn = getTurn(gameCode);

            broadcastToGame(gameCode, {
                type: 'question',
                text: newQ,
                turn: nextTurn
            });
        }

        function endOfRound(gameCode) {
            const game = games[gameCode];
            if (!game) return;

            console.log(`[${gameCode}] end of round`);
            game.cachedQuestion = null; // Clear old question so clients wait for new one
            game.questionCount = 10;
            game.votes = 0;
            game.voteCount = 0;
            game.usersRemaining = [...game.allUsers];
            game.orderQuestionAnswered = [];

            // Remove "mitä vaan" after first round if there are other topics
            const mitaVaanIndex = game.questionTopics.indexOf('mitä vaan');
            if (mitaVaanIndex > -1 && game.questionTopics.length > 1) {
                game.questionTopics.splice(mitaVaanIndex, 1);
                console.log(`[${gameCode}] Removed "mitä vaan" from topics`);
            }

            let lastIndex = game.allUsers.indexOf(game.turn);
            let nextIndex = (lastIndex + 1) % game.allUsers.length;
            game.turn = game.allUsers[nextIndex];

            if (game.orderQuestionNext) {
                game.orderQuestionNow = true;
            }
            else {
                game.orderQuestionNow = false;
            }

            for (const username of game.allUsers) {
                addHandToScore(gameCode, username);
                const newScore = game.userScores.get(username).toString();
                broadcastToGame(gameCode, {
                    type: 'end-of-round',
                    username: username,
                    score: newScore
                });
            }
            fetchAndCacheQuestion(gameCode);
        }

        try {
            const parsedData = JSON.parse(data);
            const gameCode = parsedData.gameCode;

            // Handle game creation
            if (parsedData.type === 'create-game') {
                const newGameCode = generateGameCode();
                createGame(newGameCode);
                clientGameCode = newGameCode;
                console.log(`[${newGameCode}] Game created`);

                ws.send(JSON.stringify({
                    type: 'game-created',
                    gameCode: newGameCode
                }));
                return;
            }

            // Handle joining a game
            if (parsedData.type === 'join-game') {
                const joinCode = parsedData.gameCode?.toUpperCase();

                if (!joinCode || !games[joinCode]) {
                    ws.send(JSON.stringify({
                        type: 'join-error',
                        message: 'Peliä ei löytynyt'
                    }));
                    return;
                }

                const game = games[joinCode];

                if (game.status !== 'lobby') {
                    ws.send(JSON.stringify({
                        type: 'join-error',
                        message: 'Peli on jo käynnissä'
                    }));
                    return;
                }

                clientGameCode = joinCode;
                ws.send(JSON.stringify({
                    type: 'game-joined',
                    gameCode: joinCode
                }));
                console.log(`[${joinCode}] Player joined`);
                return;
            }

            // For all other messages, require a game code
            if (!gameCode && !clientGameCode) {
                console.log('No game code provided');
                return;
            }

            const activeGameCode = gameCode || clientGameCode;
            const game = games[activeGameCode];

            if (!game) {
                console.log(`Game ${activeGameCode} not found`);
                return;
            }

            if (parsedData.type === 'username') {
                clientUsername = parsedData.username;
                clientGameCode = activeGameCode;

                // Add this client to the game's client set
                game.clients.add(ws);

                console.log(`[${activeGameCode}] User set username: ${clientUsername}`);
                game.userScores.set(clientUsername, 0);
                game.userScoresOnHand.set(clientUsername, 0);
                game.allUsers.push(clientUsername);
                game.users.push(clientUsername);
                game.usersRemaining.push(clientUsername);
                game.turn = clientUsername;

                // Broadcast player list update
                broadcastToGame(activeGameCode, {
                    type: 'player-joined',
                    username: clientUsername,
                    players: game.allUsers
                });

            } else if (parsedData.type === 'topic') {
                console.log(`[${activeGameCode}] ${parsedData.username}: ${parsedData.text}`);
                game.questionTopics.push(parsedData.text);

                broadcastToGame(activeGameCode, {
                    type: 'message',
                    username: parsedData.username,
                    text: parsedData.text
                });

            } else if (parsedData.type === 'question-click') {
                console.log(`[${activeGameCode}] ${parsedData.username} clicked question: ${parsedData.question}`);
                console.log(`[${activeGameCode}] orderQuestionNow:`, game.orderQuestionNow);
                // if question type is 3, add the answer to the orderQuestionAnswered array
                if (game.orderQuestionNow) {
                    let newOption = `${parsedData.answer}: ${parsedData.question}`;
                    game.orderQuestionAnswered.push(newOption);
                    game.orderQuestionAnswered.sort((a, b) => parseInt(a) - parseInt(b));
                    console.log(`[${activeGameCode}] orderQuestionAnswered:`, game.orderQuestionAnswered);
                    broadcastToGame(activeGameCode, {
                        type: 'correct-answer',
                        username: parsedData.username,
                        question: parsedData.question,
                        answer: parsedData.answer,
                        orderQuestionAnswered: game.orderQuestionAnswered
                    });
                }
                else {
                broadcastToGame(activeGameCode, {
                    type: 'correct-answer',
                    username: parsedData.username,
                    question: parsedData.question,
                    answer: parsedData.answer
                });
            }

            } else if (parsedData.type === 'answer-vote') {
                console.log(`[${activeGameCode}] vote received`);
                voting(activeGameCode, parsedData.username, parsedData.vote);

            } else if (parsedData.type === 'ready-message') {
                // Set connection variables for this Game.jsx connection
                clientUsername = parsedData.username;
                clientGameCode = activeGameCode;

                // Add this client to the game's client set
                game.clients.add(ws);

                const allReady = userReady(activeGameCode, parsedData.username);
                if (allReady) {
                    console.log(`[${activeGameCode}] everyone is ready`);
                    await questionRequested(activeGameCode);
                    fetchAndCacheQuestion(activeGameCode);
                }

            } else if (parsedData.type === 'give-up') {
                console.log(`[${activeGameCode}] give up received`);
                let username = parsedData.username;
                game.usersRemaining.splice(game.usersRemaining.indexOf(username), 1);
                console.log(`[${activeGameCode}] user removed from remaining users`);
                console.log(`[${activeGameCode}]`, game.usersRemaining);

                if (game.usersRemaining.length == 0) {
                    endOfRound(activeGameCode);
                } else {
                    const nextTurn = getTurn(activeGameCode);
                    broadcastToGame(activeGameCode, {
                        type: 'next-turn',
                        nextTurn: nextTurn
                    });
                }

            } else if (parsedData.type === 'continue-round') {
                console.log(`[${activeGameCode}] continue round received`);
                questionRequested(activeGameCode);
            }
        } catch (e) {
            console.log(`${clientUsername}: ${data}`);
            ws.send(`Server received: ${data}`);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${clientUsername} has disconnected`);

        if (clientGameCode && games[clientGameCode]) {
            const game = games[clientGameCode];
            game.clients.delete(ws);

            console.log(`[${clientGameCode}] Players remaining: ${game.clients.size}`);

            // Clean up empty games after 30s delay
            if (game.clients.size === 0) {
                const codeToDelete = clientGameCode;
                console.log(`[${codeToDelete}] No players left, removing in 30s...`);

                setTimeout(() => {
                    if (games[codeToDelete] && games[codeToDelete].clients.size === 0) {
                        console.log(`[${codeToDelete}] Game removed`);
                        delete games[codeToDelete];
                    }
                }, 30000);
            }
        }
    });
});
