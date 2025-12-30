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
  const inputRef = useRef(null);

  const handleLogin = (token) => {
    Cookies.set('userToken', token, { 
      expires: 1
    });
  };

  const handleStartGame = () => {
    navigate('/game');
  };

  useEffect(() => {
    if (!isUsernameSet) return; // Don't connect until username is set

    // Create WebSocket connection to port 7654
    // Use environment variable or default to localhost
    const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const websocket = new WebSocket(`ws://${wsHost}:7654`);

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('Yhdistetty');
      // Send username to server immediately after connection
      websocket.send(JSON.stringify({ type: 'username', username: username }));
    };

    websocket.onmessage = (event) => {
      console.log('Message from server:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages((prevMessages) => [...prevMessages, { 
            type: 'received', 
            text: data.text,
            username: data.username 
          }]);
        }
      } catch (e) {
        // Handle plain text messages (like welcome message)
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

    // Cleanup function to close the connection when component unmounts
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

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && inputMessage.trim()) {
      const messageData = JSON.stringify({
        type: 'topic',
        username: username,
        text: inputMessage
      });
      ws.send(messageData);
      setInputMessage('');
      // Keep focus on input to prevent keyboard from closing on mobile
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
      <h1>AI-Smart10</h1>
      
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
              Noni
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="status">
            Tilanne: <span className={`status-${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
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
              disabled={connectionStatus !== 'Yhdistetty'}
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
