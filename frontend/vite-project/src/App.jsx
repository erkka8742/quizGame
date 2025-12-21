import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie';
import './App.css'

function App() {
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);

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
    const websocket = new WebSocket('ws://localhost:7654');

    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('Connected');
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
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="app">
      <h1>ai-Smart10</h1>
      
      {!isUsernameSet ? (
        <div className="username-setup">
          <h2>Enter Your Username</h2>
          <div className="username-input-container">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                handleLogin(e.target.value);
              }}
              onKeyPress={handleUsernameKeyPress}
              placeholder="Enter your username..."
              autoFocus
            />
            <button onClick={handleUsernameSubmit} disabled={!username.trim()}>
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="status">
            <span>Username: <strong>{username}</strong> | </span>
            Status: <span className={`status-${connectionStatus.toLowerCase()}`}>{connectionStatus}</span>
          </div>
          
          <div className="messages-container">
            <h2>Enter question topics</h2>
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
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={connectionStatus !== 'Connected'}
            />
            <button 
              onClick={sendMessage} 
              disabled={connectionStatus !== 'Connected'}
            >
              Send
            </button>
          </div>

          <div className="game-control">
            <button 
              className="start-game-button"
              onClick={handleStartGame}
              disabled={connectionStatus !== 'Connected'}
            >
              Ready
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default App
