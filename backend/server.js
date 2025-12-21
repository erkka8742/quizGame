require('dotenv').config();
const { WebSocketServer } = require('ws');
const OpenAI = require('openai').default;
const { readFileSync } = require('fs');

const client = new OpenAI({
    apiKey: process.env.API_KEY,
    baseURL: "https://api.deepseek.com"
    //timeout: 360000, // Override default timeout with longer timeout for reasoning models
});

let userScores = new Map();
let userScoresOnHand = new Map();
var users = [];
let allUsers = [];
var usersRemaining = [];
let questionTopics = ['historia', 'avaruus', 'tietokoneet', 'elokuvat'];
var turn = 0;
var äänestänyt = 0
var äänet = 0
var everyoneIn = false;
var questionCount = 10;

let systemPrompt = "oot ai tai jotain"; // Default prompt

try {
    systemPrompt = readFileSync('systemPrompt.txt', 'utf-8');
  } catch (err) {
    console.error('Error reading system prompt:', err);
  }

async function newQuestion() {
    // Check if there are any topics
    if (questionTopics.length === 0) {
        console.log('No topics available yet!');
        return;
    }
    
    const topic = questionTopics[Math.floor(Math.random() * questionTopics.length)];
    const questionType = Math.floor(Math.random() * 5) + 1;
    console.log('Selected topic:', topic);
    console.log('Selected question type:', questionType);
    
    const completion = await client.chat.completions.create({
        //model: "grok-4-1-fast-non-reasoning",
        model: "deepseek-chat",
        messages: [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: topic + "\n" + questionType
            },
        ],
        temperature:1.2,
    });
    console.log(completion.choices[0].message.content);
    let question = completion.choices[0].message.content;
    question = question.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return question;
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



// Create a server on port 7654
const wss = new WebSocketServer({ port: 7654 });

console.log("WebSocket server started on port 7654");

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

                    questionCount--;
                if (questionCount == 0) {
                    questionRequested();
                    endOfRound();
                }
            }
        }

        async function questionRequested() {
            console.log('New question requested');
            let newQ = await newQuestion();
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
                    questionRequested();
                    endOfRound();
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