require('dotenv').config();
const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { readFileSync } = require('fs');
const os = require('os');
const qrcode = require('qrcode-terminal');

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

let userScores = new Map();
let userScoresOnHand = new Map();
var users = [];
let allUsers = [];
var usersRemaining = [];
let questionTopics = ['mitä vaan'];
var turn = 0;
var äänestänyt = 0
var äänet = 0
var everyoneIn = false;
var questionCount = 10;
let cachedQuestion = null; // Pre-fetched question ready to use

let systemPrompt = "oot ai tai jotain"; // Default prompt

try {
    systemPrompt = readFileSync('systemPrompt.txt', 'utf-8');
  } catch (err) {
    console.error('Error reading system prompt:', err);
  }

// Function to get local IP address
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost'; // Fallback
}

// Function to generate a new question from the API
async function generateQuestion() {
    // Check if there are any topics
    if (questionTopics.length === 0) {
        console.log('No topics available yet!');
        return null;
    }
    
    const topic = questionTopics[Math.floor(Math.random() * questionTopics.length)];
    const questionType = Math.floor(Math.random() * 5) + 1;
    console.log('Selected topic:', topic);
    console.log('Selected question type:', questionType);
    
    const prompt = `${systemPrompt}\n\n${topic}\n${questionType}`;
    
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
    //console.log(question);
    question = question.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return question;
}

// Function to fetch and cache a new question in the background
async function fetchAndCacheQuestion() {
    try {
        console.log('Fetching new question for cache...');
        cachedQuestion = await generateQuestion();
        console.log('Question cached and ready!');
    } catch (error) {
        console.error('Error fetching question:', error);
    }
}

// Function to get the cached question and immediately fetch a new one
async function getQuestion() {
    const questionToReturn = cachedQuestion;
    
    // Fetch new question in background (don't await)
    fetchAndCacheQuestion();
    
    return questionToReturn;
}

function getTurn() {
    const nextTurn = usersRemaining[turn];
    console.log('Next turn:', nextTurn);
    const userCount = usersRemaining.length - 1
    if (turn == userCount) {
        turn = 0
    }
    else {
        turn++
    }
    return nextTurn;
}

function add1PointOnHand(username) {
    let currentScore = userScoresOnHand.get(username) || 0;
    userScoresOnHand.set(username, currentScore + 1);
    console.log(`${username} now has ${currentScore + 1} points on hand`);
}

function deleteHand(username) {
    userScoresOnHand.set(username, 0);
}

function addHandToScore(username) {
    let currentScore = userScores.get(username) || 0;
    let currentScoreOnHand = userScoresOnHand.get(username) || 0;
    let newScore = currentScore + currentScoreOnHand;
    userScores.set(username, newScore);
    userScoresOnHand.set(username, 0);
    console.log(`${username} now has ${newScore} points`);
}

function userReady(username) {
    const index = users.indexOf(username);
    if (index > -1) {
        users.splice(index, 1);
        if (users.length == 0) {
            everyoneIn = true;
        }
    }
}



// Create a server on port 7654, accessible from any network interface
const wss = new WebSocketServer({ 
    port: 7654,
    host: '0.0.0.0' // Listen on all network interfaces
});

// Get local IP and display connection info
const localIP = getLocalIPAddress();
const frontendURL = `http://${localIP}:5173`;

console.log(`\n${frontendURL}\n`);

qrcode.generate(frontendURL, { small: true });

// Initialize the question cache
console.log('Initializing question cache...');
fetchAndCacheQuestion();

wss.on('connection', (ws) => {
    console.log('New client connected!');
    let clientUsername = 'Anonymous';

    ws.on('message', async (data) => {

        function voting(username, vote) {
            let playerCount = userScores.size -1;
            äänet += vote;
            äänestänyt++
            console.log(playerCount)
            console.log(äänestänyt)
            console.log(äänet)
            if (äänestänyt == playerCount) {
                console.log('everyone voted')
                // jos meni oikein
                if (äänet >= 0) {
                    add1PointOnHand(username);
                }
                // jos meni väärin
                else {
                    usersRemaining.splice(usersRemaining.indexOf(username), 1);
                    console.log('user removed from remaining users')
                    console.log(usersRemaining)
                    turn--;
                    if (turn < 0) {
                        turn = 0;
                    }
                    console.log(turn)
                    deleteHand(username);
                }
                    äänet = 0;
                    äänestänyt = 0;
                    let newScore = userScores.get(username);
                    newScore = `${newScore} + ${userScoresOnHand.get(username)}`;
                    console.log('new score of ' + username + ' is: ' + newScore)
                    
                    questionCount--;
                
                // Check if round should end (no questions left or no users remaining)
                if (questionCount == 0 || usersRemaining.length == 0) {
                    endOfRound();
                    questionRequested();
                }
                else {
                    const nextTurn = getTurn();
                    wss.clients.forEach((client) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({
                                type: 'voting-result',
                                username: username,
                                score: newScore,
                                nextTurn: nextTurn
                            }));
                        }
                    });
                }
            }
        }

        async function questionRequested() {
            console.log('New question requested');
            let newQ = await getQuestion();
            const nextTurn = getTurn();
            wss.clients.forEach((client) => {
                if (client.readyState === 1) { 
                    client.send(JSON.stringify({
                        type: 'question',
                        text: newQ,
                        turn: nextTurn
                    }));
                }
            });
        }

        function endOfRound() {
            console.log('end of round');
            questionCount = 10;
            äänet = 0;
            äänestänyt = 0;
            usersRemaining = [...allUsers];
            
            // Ensure turn index is valid for the reset array
            if (turn >= usersRemaining.length) {
                turn = 0;
            }
            
            for (const username of allUsers) {
                addHandToScore(username);
                const newScore = userScores.get(username).toString();
                wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'end-of-round',
                        username: username,
                        score: newScore
                    }));
                }
            });
            }
            
        }

        try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.type === 'username') {
                clientUsername = parsedData.username;
                console.log(`User set username: ${clientUsername}`);
                userScores.set(clientUsername, 0);
                userScoresOnHand.set(clientUsername, 0);
                allUsers.push(clientUsername);
                users.push(clientUsername);
                usersRemaining.push(clientUsername);
            } else if (parsedData.type === 'topic') {
                
                console.log(`${parsedData.username}: ${parsedData.text}`);
                questionTopics.push(parsedData.text);
               
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'message',
                            username: parsedData.username,
                            text: parsedData.text
                        }));
                    }
                });
            } else if (parsedData.type === 'new-question') {
                console.log('New question requested');
                questionRequested();
            } else if (parsedData.type === 'question-click') {
                console.log(`${parsedData.username} clicked question: ${parsedData.question}`);
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'correct-answer',
                            username: parsedData.username,
                            question: parsedData.question,
                            answer: parsedData.answer
                        }));
                    }
                });
            }
            else if (parsedData.type === 'answer-vote') {
                console.log('vote received');
                let username = parsedData.username;
                let vote = parsedData.vote;
                voting(username, vote);
            }
            else if (parsedData.type === 'ready-message') {
                userReady(parsedData.username);
                if (everyoneIn) {
                    console.log('everyone is ready');
                    questionRequested();
                }
            }
            else if (parsedData.type === 'give-up') {
                console.log('give up received');
                let username = parsedData.username;
                usersRemaining.splice(usersRemaining.indexOf(username), 1);
                console.log('user removed from remaining users')
                console.log(usersRemaining)
                turn--;
                if (turn < 0) {
                    turn = 0;
                }
                console.log(turn)

                questionCount--;
                if (questionCount == 0 || usersRemaining.length == 0) {
                    endOfRound();
                    questionRequested();
                }
                
                else {
                    const nextTurn = getTurn();
                    wss.clients.forEach((client) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({
                                type: 'next-turn',
                                nextTurn: nextTurn
                            }));
                        }
                    });
                }
            }
        } catch (e) {
            console.log(`${clientUsername}: ${data}`);
            ws.send(`Server received: ${data}`);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${clientUsername} has disconnected`);
    });
});