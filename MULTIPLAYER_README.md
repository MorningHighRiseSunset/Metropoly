# Metropoly Multiplayer Setup Guide

This guide will help you set up the multiplayer version of your Metropoly (Monopoly) game with a lobby system and real-time gameplay.

## Overview

The multiplayer system consists of:
- **Backend Server** (Node.js/Express with WebSocket) - Hosted on Render
- **Frontend Lobby** (HTML/CSS/JavaScript) - Hosted on Netlify
- **Game Integration** - Modified existing game to work with multiplayer

## Backend Setup (Render)

### 1. Create a new Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `metropoly-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if needed)

### 2. Environment Variables

Add these environment variables in your Render service settings:
- `NODE_ENV`: `production`
- `PORT`: `10000` (Render will set this automatically)

### 3. Deploy

The service will automatically deploy when you push changes to your repository.

## Frontend Setup (Netlify)

### 1. Deploy to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure the deployment:
   - **Build command**: Leave empty (static site)
   - **Publish directory**: `/` (root directory)
   - **Base directory**: Leave empty

### 2. Update WebSocket URL

In both `lobby.js` and `multiplayer.js`, update the `getServerUrl()` method:

```javascript
getServerUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'ws://localhost:3000';
    } else {
        // Replace with your actual Render WebSocket URL
        return 'wss://your-render-app-name.onrender.com';
    }
}
```

Replace `your-render-app-name` with your actual Render service name.

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 3. Start the Frontend

You can use any local server. For example, with Python:
```bash
python -m http.server 8000
```

Or with Node.js:
```bash
npx http-server
```

## File Structure

```
Metropoly/
├── server.js              # Backend server (Render)
├── package.json           # Dependencies
├── lobby.html             # Multiplayer lobby page
├── lobby.js               # Lobby functionality
├── game.html              # Multiplayer game page
├── multiplayer.js         # Multiplayer game logic
├── index.html             # Main page (updated with multiplayer link)
├── script.js              # Original game logic
├── styles.css             # Styling
└── MULTIPLAYER_README.md  # This file
```

## How It Works

### 1. Lobby System
- Players create or join rooms using room IDs
- Token selection happens in the lobby before the game starts
- Players can see who's ready and who's selected which tokens
- Host can start the game when all players are ready

### 2. Game Flow
1. Players join the lobby (`lobby.html`)
2. Create or join a room
3. Select tokens (Rolls Royce, Helicopter, Hat, Football, Burger, Nike, Woman)
4. Set ready status
5. Host starts the game
6. Players are redirected to the game (`game.html`)
7. Real-time gameplay with WebSocket communication

### 3. Multiplayer Features
- Real-time turn management
- Synchronized game state
- Player actions (dice roll, property purchase, etc.)
- Visual feedback for current player
- Connection status indicators
- Player list with money and token information

## Game Actions

The multiplayer system handles these game actions:
- **Dice Roll**: Synchronized across all players
- **Token Movement**: Visual movement with collision avoidance
- **Property Purchase**: Updates ownership for all players
- **Rent Payment**: Automatic money transfer
- **Card Drawing**: Chance and Community Chest cards
- **Jail**: Go to jail functionality
- **Bankruptcy**: Player elimination

## Customization

### Adding New Tokens

1. Add the token to the `availableTokens` array in `lobby.js`:
```javascript
const availableTokens = [
    { name: 'rolls royce', emoji: '🚗' },
    { name: 'helicopter', emoji: '🚁' },
    // Add your new token here
    { name: 'your_token', emoji: '🎯' }
];
```

2. Update the server's token validation in `server.js`

### Modifying Game Rules

Game rules are handled in the original `script.js`. The multiplayer system synchronizes the state but doesn't change the core game mechanics.

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the Render service is running
   - Verify the WebSocket URL in `lobby.js` and `multiplayer.js`
   - Ensure the service supports WebSocket connections

2. **Players Can't Join Rooms**
   - Check if the server is properly handling room creation/joining
   - Verify the room ID format
   - Check browser console for errors

3. **Game State Not Syncing**
   - Ensure all game actions are being sent via WebSocket
   - Check if the server is broadcasting updates correctly
   - Verify the client is handling server messages

### Debug Mode

Enable debug logging by adding this to your browser console:
```javascript
localStorage.setItem('debug', 'true');
```

## Security Considerations

- The current implementation is for demonstration purposes
- For production, consider adding:
  - User authentication
  - Input validation
  - Rate limiting
  - HTTPS/WSS for secure connections
  - Anti-cheat measures

## Performance Optimization

- The game uses WebSocket for real-time communication
- Consider implementing:
  - Message compression
  - State delta updates
  - Connection pooling
  - Load balancing for multiple game rooms

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the Render service logs
3. Ensure all dependencies are installed
4. Test with a local server first

## Future Enhancements

Potential improvements:
- Chat system
- Spectator mode
- Game replays
- Tournament system
- Mobile optimization
- Voice chat integration
- Custom game rules
- AI players in multiplayer 