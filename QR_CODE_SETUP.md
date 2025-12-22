# QR Code Setup Guide

## What's New

Your server now automatically:
1. 🔍 Finds your local IP address
2. 📱 Generates a QR code for easy phone access
3. 🖨️ Displays all connection info in the console

## How to Use

### Step 1: Start the Backend Server

```bash
cd backend
node server.js
```

### Step 2: You'll See Something Like This:

```
==============================================
🎮 Quiz Game Server Started!
==============================================

📱 Frontend URL: http://192.168.1.100:5173
🔌 WebSocket URL: ws://192.168.1.100:7654
💻 Local IP: 192.168.1.100

==============================================
📱 Scan this QR code with your phone:
==============================================

  █▀▀▀▀▀█ ▀▀▄█  █▀█ █▀▀▀▀▀█
  █ ███ █ ▄ ██ ▀▄  █ ███ █
  █ ▀▀▀ █ █▀▄▄█ █▀ █ ▀▀▀ █
  ▀▀▀▀▀▀▀ █ ▀ ▀ ▀ █ ▀▀▀▀▀▀
  ▀█▄▀▀█▀▄██▄ ▀▄█▀█▀█▄▀▀▄▀
  ██ ▀  ▀ █▀▄▄  ▄█▀▀▄ ▀▀▄
  ▄▀ █▄█▀ ▄█ ▀▀█ ▀▀█▄ ▀▀▀
  ▀▀▀▀▀▀▀ █ ▀ ▄█▀▀▀█ █▄▀█
  █▀▀▀▀▀█ █ ▀█ █ █ ▀ ▀█▀█
  █ ███ █  ▄▀▄█▀█▀▀▀█▄▄▄█
  █ ▀▀▀ █ ▀▄ ▄▀ █▀█▄█▀▄▀█
  ▀▀▀▀▀▀▀ ▀   ▀▀ ▀  ▀▀  ▀

==============================================
ℹ️  Make sure your phone is on the same WiFi!
==============================================
```

### Step 3: Start the Frontend

In a **new terminal**:

```bash
cd frontend/vite-project
npm run dev
```

### Step 4: Connect Your Phone

**Option 1: Scan QR Code (Easiest)**
1. Open your phone's camera app
2. Point it at the QR code in the terminal
3. Tap the notification/link that appears
4. The game will open in your browser!

**Option 2: Manual Entry**
1. Open your phone's browser
2. Type the URL shown (e.g., `http://192.168.1.100:5173`)
3. The game will load

## Why This Is Better

### Before:
- Had to manually find your IP address
- Had to type long URLs on phone keyboard
- Easy to make typos

### Now:
- 📱 Just scan the QR code!
- ⚡ Instant connection
- ✅ No typing required

## Troubleshooting

### QR Code Doesn't Scan
- Make sure the terminal window is large enough to display the full QR code
- Try zooming out in your terminal
- Or just use the URL shown above the QR code

### Phone Can't Connect
1. ✅ Check both devices are on same WiFi network
2. ✅ Make sure frontend is running (`npm run dev`)
3. ✅ Check Windows Firewall allows ports 5173 and 7654
4. ✅ Try accessing from your computer first using the shown URL

### Wrong IP Address Shown
If you have multiple network adapters, the server picks the first non-internal IPv4 address. If it picks the wrong one:
1. Disable unused network adapters
2. Or manually note the correct IP from `ipconfig` command

## Tips

- **Keep the terminal visible**: You can show the QR code to multiple people
- **Screenshot it**: Take a photo of the QR code to share via messaging apps
- **Tablet Support**: QR codes work great for tablets too!
- **Multiple Players**: Everyone scans the same QR code to join

## Example Terminal Commands

```bash
# Terminal 1 - Backend
cd c:\Users\erkka\Documents\quizGame\backend
node server.js

# Terminal 2 - Frontend
cd c:\Users\erkka\Documents\quizGame\frontend\vite-project
npm run dev
```

Enjoy your quiz game! 🎮🎉

