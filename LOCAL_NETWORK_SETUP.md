# Local Network Setup Guide

## What Was Changed

### Backend (server.js)
- WebSocket server now listens on `0.0.0.0` instead of just localhost
- This allows connections from any device on your local network

### Frontend (vite.config.js, App.jsx, Game.jsx)
- Vite dev server configured to accept connections from network
- WebSocket connections now use dynamic host resolution
- Will automatically connect to the server on the same machine

## How to Use on Local Network

### Step 1: Find Your Computer's IP Address

**On Windows:**
1. Open PowerShell or Command Prompt
2. Run: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter
4. Example: `192.168.1.100`

### Step 2: Start the Backend Server

```bash
cd backend
node server.js
```

The server will start on port 7654 and be accessible from any device on your network.

### Step 3: Start the Frontend

```bash
cd frontend/vite-project
npm run dev
```

Vite will show you the network URLs, something like:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

### Step 4: Connect from Other Devices

On any device on the same network (phone, tablet, other computer):
1. Open a web browser
2. Go to the Network URL shown by Vite (e.g., `http://192.168.1.100:5173/`)
3. The app will automatically connect to the WebSocket server

## Important Notes

### Firewall Settings
You may need to allow incoming connections on ports:
- **7654** (WebSocket server)
- **5173** (Vite dev server)

**Windows Firewall:**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Create new Inbound Rules for ports 7654 and 5173

### Alternative: Manual Host Configuration

If you need to specify a different server address, create a `.env` file in `frontend/vite-project/`:

```env
VITE_WS_HOST=192.168.1.100
```

Replace `192.168.1.100` with your server's actual IP address.

## Troubleshooting

### Can't Connect from Other Devices
1. Check firewall settings
2. Verify both devices are on the same network
3. Try pinging the server's IP from the client device
4. Make sure both backend and frontend servers are running

### WebSocket Connection Failed
1. Verify backend server is running
2. Check that port 7654 is not blocked
3. Look at browser console for error messages
4. Try accessing from the server computer first (using Network URL)

### Finding Network Issues
```bash
# On the client device, ping the server
ping 192.168.1.100

# Check if ports are accessible (use telnet or online tools)
```

## Security Note

This setup is for local network development only. For production or internet-accessible deployments, you should:
- Add authentication
- Use WSS (secure WebSocket) instead of WS
- Implement proper CORS policies
- Use environment variables for sensitive data

