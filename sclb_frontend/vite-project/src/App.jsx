import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie';
import './App.css'

function App() {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Ei yhdistetty');
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isInGame, setIsInGame] = useState(false);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const wsRef = useRef(null);

  const handleLogin = (token) => {
    Cookies.set('userToken', token, {
      expires: 1
    });
  };

  const handleStartGame = () => {
    // Store game code in cookie for Game.jsx to access
    Cookies.set('gameCode', gameCode, { expires: 1 });
    navigate('/game');
  };

  // Connect to WebSocket when username is set
  useEffect(() => {
    if (!isUsernameSet) return;

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
    wsRef.current = websocket;

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('Yhdistetty');
    };

    websocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'game-created') {
          setGameCode(data.gameCode);
          setIsInGame(true);
          setError('');
          // Send username to join the game we just created
          websocket.send(JSON.stringify({
            type: 'username',
            username: username,
            gameCode: data.gameCode
          }));
        }

        if (data.type === 'game-joined') {
          setGameCode(data.gameCode);
          setIsInGame(true);
          setError('');
          // Send username to register in the game
          websocket.send(JSON.stringify({
            type: 'username',
            username: username,
            gameCode: data.gameCode
          }));
        }

        if (data.type === 'join-error') {
          setError(data.message);
        }

        if (data.type === 'player-joined') {
          setPlayers(data.players);
        }

        if (data.type === 'message') {
          setMessages((prevMessages) => [...prevMessages, {
            type: 'received',
            text: data.text,
            username: data.username
          }]);
        }
      } catch (e) {
        setMessages((prevMessages) => [...prevMessages, { type: 'received', text: event.data }]);
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

    return () => {
      websocket.close();
    };
  }, [isUsernameSet, username]);

  const handleUsernameSubmit = () => {
    if (username.trim()) {
      setIsUsernameSet(true);
    }
  };

  const handleUsernameKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleUsernameSubmit();
    }
  };

  const handleCreateGame = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'create-game' }));
    }
  };

  const handleJoinGame = () => {
    if (ws && ws.readyState === WebSocket.OPEN && joinCode.trim()) {
      setError('');
      ws.send(JSON.stringify({
        type: 'join-game',
        gameCode: joinCode.trim().toUpperCase()
      }));
    }
  };

  const handleJoinKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinGame();
    }
  };

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && inputMessage.trim()) {
      const messageData = JSON.stringify({
        type: 'topic',
        username: username,
        text: inputMessage,
        gameCode: gameCode
      });
      ws.send(messageData);
      setInputMessage('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      <h1>PartyQuiz</h1>

      {/* Step 1: Username setup */}
      {!isUsernameSet ? (
        <div className="username-setup">
          <h2>Anna käyttäjänimi</h2>
          <div className="username-input-container">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                handleLogin(e.target.value);
              }}
              onKeyPress={handleUsernameKeyPress}
              placeholder="Tähän..."
              autoFocus
            />
            <button onClick={handleUsernameSubmit} disabled={!username.trim()}>
              Valmis
            </button>
          </div>
        </div>
      ) : !isInGame ? (
        /* Step 2: Create or Join game */
        <div className="game-select">
          <div className="status">
            Tilanne: <span className={`status-${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
          </div>

          <div className="game-options">
            <div className="create-game-section">
              <h2>Luo uusi peli</h2>
              <button
                className="create-game-button"
                onClick={handleCreateGame}
                disabled={connectionStatus !== 'Yhdistetty'}
              >
                Luo peli
              </button>
            </div>

            <div className="divider">tai</div>

            <div className="join-game-section">
              <h2>Liity peliin</h2>
              <div className="join-input-container">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyPress={handleJoinKeyPress}
                  placeholder="Pelikoodi"
                  maxLength={4}
                  disabled={connectionStatus !== 'Yhdistetty'}
                />
                <button
                  onClick={handleJoinGame}
                  disabled={connectionStatus !== 'Yhdistetty' || !joinCode.trim()}
                >
                  Liity
                </button>
              </div>
              {error && <p className="error-message">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
        /* Step 3: Game lobby */
        <>
          <div className="game-code-display">
            <span className="game-code-label">Pelikoodi:</span>
            <span className="game-code">{gameCode}</span>
          </div>

          <div className="status">
            Tilanne: <span className={`status-${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
          </div>

          <div className="players-list">
            <h3>
              Pelaajat ({players.length})
              {players.length === 1 && <span style={{ color: '#ff6b6b', fontSize: '0.9em', marginLeft: '10px' }}>tarvitsee vähintään 2</span>}
            </h3>
            <ul>
              {players.map((player, index) => (
                <li key={index} className={player === username ? 'current-player' : ''}>
                  {player} {player === username && '(sinä)'}
                </li>
              ))}
            </ul>
          </div>

          <div className="messages-container">
            <h2>Anna kysymysaiheita</h2>
            <div className="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.type} ${msg.username === username ? 'own-message' : ''}`}>
                  <strong>
                    {msg.username ? `${msg.username}: ` : 'Server: '}
                  </strong>
                  {msg.text}
                </div>
              ))}
            </div>
          </div>

          <div className="input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Aiheita..."
              disabled={connectionStatus !== 'Yhdistetty'}
            />
            <button
              onClick={sendMessage}
              disabled={connectionStatus !== 'Yhdistetty'}
            >
              Lähetä
            </button>
          </div>

          <div className="game-control">
            <button
              className="start-game-button"
              onClick={handleStartGame}
              disabled={connectionStatus !== 'Yhdistetty' || players.length < 2}
            >
              Valmis
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default App
