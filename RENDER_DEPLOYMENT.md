# Deploying to Render

This guide explains how to deploy your scalable_backend and sclb_frontend to Render.

## Prerequisites

- A Render account (sign up at https://render.com)
- Google Generative AI API key
- Both backend and frontend code ready for deployment

## Backend Deployment (scalable_backend)

### 1. Create a New Web Service

1. Log into Render and click **New +** → **Web Service**
2. Connect your GitHub/GitLab repository (or use Manual Deploy)
3. Configure the service:
   - **Name**: Choose a name (e.g., `ai-smart10-backend`)
   - **Region**: Choose closest to your users
   - **Branch**: main (or your deployment branch)
   - **Root Directory**: `scalable_backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid for better performance)

### 2. Set Environment Variables

In the Render dashboard for your backend service, add these environment variables:

```
API_KEY=<your-google-generative-ai-key>
NODE_ENV=production
```

**Note**: Do NOT set PORT - Render automatically provides this.

### 3. Deploy

- Click **Create Web Service**
- Wait for the deployment to complete
- Note your backend URL (e.g., `https://ai-smart10-backend.onrender.com`)

## Frontend Deployment (sclb_frontend)

### 1. Create a New Static Site

1. In Render, click **New +** → **Static Site**
2. Connect your repository
3. Configure the static site:
   - **Name**: Choose a name (e.g., `ai-smart10-frontend`)
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Root Directory**: `sclb_frontend/vite-project`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### 2. Set Environment Variables

Add this environment variable (replace with your actual backend URL):

```
VITE_BACKEND_URL=wss://ai-smart10-backend.onrender.com
```

**Important**: Use `wss://` (not `https://`) for WebSocket connections.

### 3. Deploy

- Click **Create Static Site**
- Wait for build and deployment
- Access your frontend at the provided URL

## Configuration Changes Made

### Backend Changes (scalable_backend/server.js)

- Uses `process.env.PORT` for the WebSocket port (Render provides this)
- Disables QR code generation in production
- Configured to bind to `0.0.0.0` for external access

### Frontend Changes (both App.jsx and Game.jsx)

- Reads `VITE_BACKEND_URL` environment variable for production
- Falls back to local development URLs when not set
- Automatically uses WSS protocol when served over HTTPS

## Testing the Deployment

1. **Backend Health Check**: 
   - Render will show "Live" status when backend is running
   - Check logs for "WebSocket server running on port X"

2. **Frontend Access**:
   - Visit your frontend URL
   - Open browser console to verify WebSocket connection
   - Should see "Connecting to WebSocket: wss://..."

3. **Game Functionality**:
   - Create a new game
   - Join from multiple devices/browsers
   - Test all game features

## Troubleshooting

### WebSocket Connection Failed

- Verify `VITE_BACKEND_URL` is set correctly in frontend environment variables
- Ensure it starts with `wss://` (not `ws://` or `https://`)
- Check backend logs for errors
- Confirm backend service is "Live"

### Backend Not Starting

- Check backend logs in Render dashboard
- Verify `API_KEY` environment variable is set
- Ensure all dependencies are in package.json

### Frontend Build Fails

- Check build logs
- Verify `npm run build` works locally
- Ensure all dependencies are listed in package.json

## Free Tier Limitations

Render's free tier has some limitations:

- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Consider upgrading to paid tier for production use

## Local Development

To continue local development:

1. **Backend**: Create `.env` file from `.env.example`
2. **Frontend**: No environment variables needed (uses localhost by default)
3. Run backend: `cd scalable_backend && npm start`
4. Run frontend: `cd sclb_frontend/vite-project && npm run dev`

## Environment Variable Files

- `scalable_backend/.env.example` - Backend environment template
- `sclb_frontend/vite-project/.env.example` - Frontend environment template

Copy these to `.env` and fill in your values for local development.
