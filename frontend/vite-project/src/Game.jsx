import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie'
import './Game.css'

function Game() {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const username = Cookies.get('userToken') || 'Anonymous';
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const optionsRef = useRef([]); // Ref to always have current options
  const [questionData, setQuestionData] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [playerScores, setPlayerScores] = useState({});
  const [clickedOptions, setClickedOptions] = useState([]);
  const [questionsRemaining, setQuestionsRemaining] = useState(10);
  const [hasGivenUp, setHasGivenUp] = useState(false);

  // Keep optionsRef in sync with options state
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Create WebSocket connection to port 7654
    // Use environment variable or default to current hostname
    const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const websocket = new WebSocket(`ws://${wsHost}:7654`);

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('Connected');
      // Send ready message with username when connection is established
      websocket.send(JSON.stringify({ 
        type: 'ready-message', 
        username: username 
      }));
    };

    websocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'question') {
          // Parse the nested JSON from the AI
          const parsedQuestionData = JSON.parse(data.text);
          console.log('Question received:', parsedQuestionData);
          
          setQuestionData(parsedQuestionData);
          setCurrentQuestion(parsedQuestionData.question);
          
          // Convert options object to array
          const optionsArray = Object.values(parsedQuestionData.options || {});
          setOptions(optionsArray);
          
          // Reset clicked options and set questions remaining to 10
          setClickedOptions([]);
          setQuestionsRemaining(10);
          
          // Check if it's this user's turn
          if (data.turn === username) {
            setIsMyTurn(true);
          } else {
            setIsMyTurn(false);
          }
        }
        if (data.type === 'correct-answer') {
          
          
          if (data.username !== username) {
            // Remove the question from the list when another user answers
            const questionIndex = optionsRef.current.indexOf(data.question);
            if (questionIndex > -1) {
              setClickedOptions(prev => [...prev, questionIndex]);
              setQuestionsRemaining(prev => prev - 1);
            }
            
            setPopupData({
              username: data.username,
              question: data.question,
              answer: data.answer
            });
          }
        }
        if (data.type === 'voting-result') {
          // Update individual player score (as string)
          if (data.username && data.score) {
            setPlayerScores(prevScores => ({
              ...prevScores,
              [data.username]: data.score
            }));
          }
          
          // Check if it's the current user's turn
          if (data.nextTurn === username) {
            setIsMyTurn(true);
          } else {
            setIsMyTurn(false);
          }
        }
        if (data.type === 'end-of-round') {
          // Update player score at end of round
          if (data.username && data.score) {
            setPlayerScores(prevScores => ({
              ...prevScores,
              [data.username]: data.score
            }));
          }
        }
        if (data.type === 'next-turn') {
          if (data.nextTurn === username) {
            setIsMyTurn(true);
            setHasGivenUp(false); // Reset give up button when it's your turn again
          } else {
            setIsMyTurn(false);
          }
        }
      } catch (e) {
        console.error('Error parsing JSON:', e);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('Error');
    };

    websocket.onclose = () => {
      console.log('WebSocket Disconnected');
      setConnectionStatus('Disconnected');
    };

    setWs(websocket);

    // Cleanup function to close the connection when component unmounts
    return () => {
      websocket.close();
    };
  }, [username]);

  const handleOptionClick = (index) => {
    if (!isMyTurn) return;
    if (clickedOptions.includes(index)) return; // Already clicked
    
    // Send username and clicked question to websocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      const optionNumber = (index + 1).toString();
      const answer = questionData?.answers?.[optionNumber];
      
      ws.send(JSON.stringify({
        type: 'question-click',
        username: username,
        question: options[index],
        answer: answer
      }));
      
      // Mark option as clicked and decrease remaining count
      setClickedOptions(prev => [...prev, index]);
      setQuestionsRemaining(prev => prev - 1);
      
      // End turn after clicking a question
      setIsMyTurn(false);
    }
  };

  const handlePopupYes = () => {
    if (ws && ws.readyState === WebSocket.OPEN && popupData) {
      ws.send(JSON.stringify({
        type: 'answer-vote',
        username: popupData.username,
        vote: 1
      }));
    }
    console.log('Yes clicked');
    setPopupData(null);
  };

  const handlePopupNo = () => {
    if (ws && ws.readyState === WebSocket.OPEN && popupData) {
      ws.send(JSON.stringify({
        type: 'answer-vote',
        username: popupData.username,
        vote: -1
      }));
    }
    console.log('No clicked');
    setPopupData(null);
  };

  const handleGiveUp = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'give-up',
        username: username
      }));
      setHasGivenUp(true);
      setIsMyTurn(false); // End turn immediately after giving up
      console.log('Give up clicked');
    }
  };

  return (
    <div className="game-container">
      <div className="scoreboard">
        <h2>Scoreboard</h2>
        <div className="scores-list">
          {Object.entries(playerScores).length > 0 ? (
            Object.entries(playerScores).map(([player, score]) => (
              <div key={player} className={`score-item ${player === username ? 'current-user' : ''}`}>
                <span className="player-name">{player}</span>
                <span className="player-score">{score}</span>
              </div>
            ))
          ) : (
            <p className="no-scores">No scores yet</p>
          )}
        </div>
      </div>

      {currentQuestion && (
        <div className="question-display">
          <h1 className="question-text">{currentQuestion}</h1>
          
          <div className="options-container">
            {options.map((option, index) => {
              // Don't render clicked options
              if (clickedOptions.includes(index)) return null;
              
              return (
                <button 
                  key={index}
                  className={`option-button ${!isMyTurn ? 'disabled' : ''}`}
                  onClick={() => handleOptionClick(index)}
                  disabled={!isMyTurn}
                >
                  <div className="option-text">{option}</div>
                </button>
              );
            })}
          </div>
          
          <button 
            className="give-up-button"
            onClick={handleGiveUp}
            disabled={connectionStatus !== 'Connected' || hasGivenUp}
          >
            Give Up
          </button>
        </div>
      )}

      {popupData && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="popup-info">
              <p><strong>User:</strong> {popupData.username}</p>
              <p><strong>Question:</strong> {popupData.question}</p>
              <p><strong>Answer:</strong> {popupData.answer}</p>
            </div>
            <div className="popup-buttons">
              <button className="popup-yes" onClick={handlePopupYes}>Yes</button>
              <button className="popup-no" onClick={handlePopupNo}>No</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Game

