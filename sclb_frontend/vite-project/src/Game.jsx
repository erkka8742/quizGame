import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie'
import './Game.css'

function Game() {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Ei yhdistetty');
  const username = Cookies.get('userToken') || 'Anonymous';
  const gameCode = Cookies.get('gameCode') || '';
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const optionsRef = useRef([]);
  const [questionData, setQuestionData] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [playerScores, setPlayerScores] = useState({});
  const [clickedOptions, setClickedOptions] = useState([]);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('');
  const [myAnswerPopup, setMyAnswerPopup] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [currentTurn, setCurrentTurn] = useState('');
  const leaderboardTimerRef = useRef(null);
  const autoContinueTimerRef = useRef(null);
  const roundEndProcessed = useRef(false);
  const [myScoreButton, setMyScoreButton] = useState('0');
  const [questionsRemaining, setQuestionsRemaining] = useState(10);
  const [orderQuestionAnswered, setOrderQuestionAnswered] = useState([]);
  const [expandedOption, setExpandedOption] = useState(null);

  useEffect(() => {
      if (myAnswerPopup) {
        const timer = setTimeout(() => {
          setMyAnswerPopup(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }, [myAnswerPopup]);

  useEffect(() => {
    if (popupData) {
      const timer = setTimeout(() => {
        voteMissed();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [popupData]);

  // Redirect to lobby if no game code
  useEffect(() => {
    if (!gameCode) {
      navigate('/');
    }
  }, [gameCode, navigate]);

  // Keep optionsRef in sync with options state
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!gameCode) return;

    // Use environment variable for backend URL, or construct from window location
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    let websocketUrl;
    
    if (backendUrl) {
      // Use the provided backend URL (for production)
      websocketUrl = backendUrl;
    } else {
      // For local development, construct from hostname
      const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = import.meta.env.VITE_WS_PORT || '7654';
      websocketUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
    }
    
    console.log('Connecting to WebSocket:', websocketUrl);
    const websocket = new WebSocket(websocketUrl);

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('Yhdistetty');
      // Send ready message with username and game code
      websocket.send(JSON.stringify({
        type: 'ready-message',
        username: username,
        gameCode: gameCode
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
          setCurrentTopic(parsedQuestionData.category || parsedQuestionData.topic || 'Quiz');

          // Convert options object to array
          const optionsArray = Object.values(parsedQuestionData.options || {});
          setOptions(optionsArray);

          // Reset clicked options and set questions remaining to 10
          setClickedOptions([]);
          setQuestionsRemaining(10);
          setHasGivenUp(false);
          setMyAnswerPopup(null);
          setShowLeaderboard(false);
          setExpandedOption(null);
          roundEndProcessed.current = false;
          console.log('New question received - roundEndProcessed reset to false');

          // Scroll to top when new question arrives
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Check if it's this user's turn
          setCurrentTurn(data.turn);
          if (data.turn === username) {
            setIsMyTurn(true);
          } else {
            setIsMyTurn(false);
          }
        }
        if (data.type === 'correct-answer') {
          setCurrentTurn('Äänestys')

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
          if (data.orderQuestionAnswered) {
            setOrderQuestionAnswered(data.orderQuestionAnswered);
          }
        }
        if (data.type === 'voting-result') {
          // Update individual player score (as string)
          if (data.username && data.score) {
            setPlayerScores(prevScores => ({
              ...prevScores,
              [data.username]: data.score
            }));
            if (data.username === username) {
              setMyScoreButton(data.score);
            }
          }

          // Check if it's the current user's turn
          setCurrentTurn(data.nextTurn);
          if (data.nextTurn === username) {
            setIsMyTurn(true);
          } else {
            setIsMyTurn(false);
          }
        }
        if (data.type === 'end-of-round') {
          console.log('Received end-of-round for:', data.username);
          setOrderQuestionAnswered([]);
          

          // Update player score at end of round
          if (data.username && data.score) {
            setPlayerScores(prevScores => ({
              ...prevScores,
              [data.username]: data.score
            }));
            if (data.username === username) {
              setMyScoreButton(data.score);
            }
          }

          // Only set timers ONCE per round (for the first end-of-round message)
          if (!roundEndProcessed.current) {
            console.log('✓ First end-of-round message - setting up timers');
            roundEndProcessed.current = true;

            // Clear any existing timers
            if (leaderboardTimerRef.current) {
              clearTimeout(leaderboardTimerRef.current);
            }
            if (autoContinueTimerRef.current) {
              clearTimeout(autoContinueTimerRef.current);
            }

            // Show leaderboard after short delay
            leaderboardTimerRef.current = setTimeout(() => {
              console.log('Showing leaderboard');
              setShowLeaderboard(true);

              // Set 4-second auto-continue timer
              autoContinueTimerRef.current = setTimeout(() => {
                console.log('Auto-continue timer fired - requesting new round');
                setShowLeaderboard(false);
                setCurrentQuestion(null); // Show loading state while waiting for new question
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({
                    type: 'continue-round',
                    gameCode: gameCode
                  }));
                }
              }, 3000);
            }, 100);
          }
        }
        if (data.type === 'next-turn') {
          setCurrentTurn(data.nextTurn);
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
      setConnectionStatus('Virhe');
    };

    websocket.onclose = () => {
      console.log('WebSocket Disconnected');
      setConnectionStatus('Ei yhdistetty');
    };

    setWs(websocket);

    // Cleanup function to close the connection when component unmounts
    return () => {
      websocket.close();
      if (leaderboardTimerRef.current) {
        clearTimeout(leaderboardTimerRef.current);
      }
      if (autoContinueTimerRef.current) {
        clearTimeout(autoContinueTimerRef.current);
      }
    };
  }, [username, gameCode]);

  const handleOptionClick = (index) => {
    if (!isMyTurn) return;
    if (clickedOptions.includes(index)) return;

    // Expand the button to show answer and yes/no options
    setExpandedOption(index);
  };

  const handleOptionConfirm = (index) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const optionNumber = (index + 1).toString();
      const answer = questionData?.answers?.[optionNumber];
      setCurrentTurn('Äänestys')

      // Show answer popup to the user
      setMyAnswerPopup({
        question: options[index],
        answer: answer
      });

      ws.send(JSON.stringify({
        type: 'question-click',
        username: username,
        question: options[index],
        answer: answer,
        gameCode: gameCode
      }));

      // Mark option as clicked and decrease remaining count
      setClickedOptions(prev => [...prev, index]);
      setQuestionsRemaining(prev => prev - 1);

      // End turn after clicking a question
      setIsMyTurn(false);
      setExpandedOption(null);
    }
  };

  const handleOptionCancel = () => {
    setExpandedOption(null);
  };

  const handlePopupYes = () => {
    if (ws && ws.readyState === WebSocket.OPEN && popupData) {
      ws.send(JSON.stringify({
        type: 'answer-vote',
        username: popupData.username,
        vote: 1,
        gameCode: gameCode
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
        vote: -1,
        gameCode: gameCode
      }));
    }
    console.log('No clicked');
    setPopupData(null);
  };

  const voteMissed = () => {
    if (ws && ws.readyState === WebSocket.OPEN && popupData) {
      ws.send(JSON.stringify({
        type: 'answer-vote',
        username: popupData.username,
        vote: -0,
        gameCode: gameCode
      }));
    }
    console.log('No clicked');
    setPopupData(null);
  };

  const handleGiveUp = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'give-up',
        username: username,
        gameCode: gameCode
      }));
      setHasGivenUp(true);
      setIsMyTurn(false);
      console.log('Give up clicked');
    }
  };


  // Get sorted leaderboard
  const getLeaderboard = () => {
    return Object.entries(playerScores)
      .map(([player, score]) => ({
        player,
        score: typeof score === 'string' ? parseInt(score.split('+')[0]) : score
      }))
      .sort((a, b) => b.score - a.score);
  };

  return (
    <div className="game-container">
      {/* Sticky Header Bar */}
      <div className="header-bar">
        <div className="topic-display">
          {!currentQuestion ? (
            <span className="topic-text">Luodaan kysymystä...</span>
          ) : (
            <>
              {currentTopic && <span className="topic-text">{currentTopic}</span>}
              {currentTurn && <span className="current-turn-text">Vuorossa: {currentTurn}</span>}
            </>
          )}
        </div>
        <button
          className="scoreboard-toggle-button"
          onClick={() => setShowScoreboard(!showScoreboard)}
        >{myScoreButton}
        </button>
      </div>

      

      {/* Toggleable Scoreboard */}
      {showScoreboard && (
        <div className="scoreboard-overlay" onClick={() => setShowScoreboard(false)}></div>
      )}
      <div className={`scoreboard ${showScoreboard ? 'visible' : 'hidden'}`}>
        <h2>Pisteet</h2>
        <div className="scores-list">
          {Object.entries(playerScores).length > 0 ? (
            Object.entries(playerScores).map(([player, score]) => (
              <div key={player} className="score-item">
                <span className="player-name">{player}</span>
                <span className="player-score">{score}</span>
              </div>
            ))
          ) : (
            <p className="no-scores">Ei vielä pisteitä</p>
          )}
        </div>
      </div>

      {currentQuestion && (
        <div className="question-display">
          <h1 className="question-text">{currentQuestion}</h1>
          <p className="order-question-answered-text">{orderQuestionAnswered.join(', ')}</p>

          <div className="options-container">
            {options.map((option, index) => {
              // Don't render clicked options
              if (clickedOptions.includes(index)) return null;

              const isExpanded = expandedOption === index;
              const optionNumber = (index + 1).toString();
              const answer = questionData?.answers?.[optionNumber];

              return (
                <div
                  key={index}
                  className={`option-button ${!isMyTurn ? 'disabled' : ''} ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => !isExpanded && handleOptionClick(index)}
                  style={{ cursor: !isMyTurn ? 'not-allowed' : 'pointer' }}
                >
                  <div className="option-text">{option}</div>
                  {isExpanded && (
                    <div className="option-expanded-content">
                      <div className="option-confirm-text">Haluatko vastata?</div>
                      <div className="option-confirm-buttons">
                        <button
                          className="option-yes"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOptionConfirm(index);
                          }}
                        >
                          Kyllä
                        </button>
                        <button
                          className="option-no"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOptionCancel();
                          }}
                        >
                          Ei
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="give-up-button"
            onClick={handleGiveUp}
            disabled={connectionStatus !== 'Yhdistetty' || hasGivenUp || !isMyTurn}
          >
            Luovuta
          </button>
        </div>
      )}

      {/* My Answer Popup */}
      {myAnswerPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="popup-info">
              <p className="popup-question">{myAnswerPopup.question}</p>
              <p className="correct-answer-label">Oikea vastaus: <strong>{myAnswerPopup.answer}</strong></p>
            </div>
          </div>
        </div>
      )}

      {popupData && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="popup-info">
              <p className="popup-question">{popupData.question}</p>
              <p>Sanoiko <span style={{ fontWeight: 'bold', color: 'inherit' }}>{popupData.username}</span> <strong>{popupData.answer}</strong>?</p>
            </div>
            <div className="popup-buttons">
              <button className="popup-yes" onClick={handlePopupYes}>Kyllä</button>
              <button className="popup-no" onClick={handlePopupNo}>Ei</button>
            </div>
          </div>
        </div>
      )}

      {/* End of Round Leaderboard */}
      {showLeaderboard && (
        <div className="popup-overlay">
          <div className="leaderboard-popup">
            <h2 className="leaderboard-title">Pistetilanne</h2>
            <div className="leaderboard-list">
              {getLeaderboard().map((entry, index) => (
                <div key={entry.player} className="leaderboard-item">
                  <span className="leaderboard-rank">{index + 1}.</span>
                  <span className="leaderboard-player">{entry.player}</span>
                  <span className="leaderboard-score">{entry.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Game
