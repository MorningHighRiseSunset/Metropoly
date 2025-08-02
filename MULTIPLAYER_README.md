# Metropoly - Multiplayer Monopoly Game

A real-time multiplayer version of Monopoly built with Node.js, Socket.IO, and Three.js.

## Features

- **Lobby System**: Create and join game rooms with unique codes
- **Real-time Gameplay**: Live updates using WebSockets
- **2-8 Players**: Support for up to 8 players per game
- **Player Reconnection**: Automatic reconnection support
- **Token Selection**: Choose from 8 different game tokens
- **Server-side Validation**: Secure game logic and state management
- **Turn-based Gameplay**: Synchronized turns with timeout handling

## Architecture

### Frontend (Netlify)
- `lobby.html` - Room creation and joining interface
- `room.html` - Token selection and game preparation
- `game.html` - Main game interface (modified for multiplayer)
- `game.js` - Multiplayer game logic integration

### Backend (Render)
- `server.js` - Express + Socket.IO server
- In-memory session management and game state
- Real-time WebSocket communication

## Setup Instructions

### Prerequisites
- Node.js 16+ 
- Netlify account (for frontend)
- Render account (for backend)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Metropoly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm run dev
   ```

5. **Open the application**
   - Navigate to `http://localhost:3000/lobby.html`
   - Create or join a game room

### Production Deployment

#### Backend (Render)

1. **Create a Render account** at [render.com](https://render.com)

2. **Deploy using render.yaml**
   ```bash
   # Push your code to GitHub
   git push origin main
   
   # Connect your GitHub repo to Render
   # Render will automatically detect the render.yaml file
   ```

3. **Manual deployment (alternative)**
   - Create a new Web Service on Render
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables:
     - `NODE_ENV=production`
     - `PORT=10000`

#### Frontend (Netlify)

1. **Create a Netlify account** at [netlify.com](https://netlify.com)

2. **Deploy from Git**
   - Connect your GitHub repository
   - Set build settings:
     - Build command: (leave empty - static site)
     - Publish directory: `.` (root)
   - Add environment variables:
     - `REACT_APP_SERVER_URL` = your Render backend URL

3. **Update server URLs**
   - In `lobby.html`, `room.html`, and `game.js`
   - Replace `https://your-render-backend.onrender.com` with your actual Render URL

4. **Configure redirects**
   - Create `_redirects` file in root:
   ```
   /*    /index.html   200
   ```

## Game Flow

1. **Lobby Creation/Joining**
   - Players create or join rooms via `lobby.html`
   - Room codes are generated automatically
   - Players can copy and share room codes

2. **Token Selection**
   - Players select unique tokens in `room.html`
   - Host can start the game when all tokens are selected
   - Real-time chat available during preparation

3. **Gameplay**
   - Turn-based gameplay with server validation
   - Real-time dice rolling and token movement
   - Property purchasing and rent collection
   - Automatic turn management with timeouts

## API Endpoints

### WebSocket Events

#### Client to Server
- `create-lobby` - Create a new game room
- `join-lobby` - Join an existing room
- `start-game` - Start the game (host only)
- `select-token` - Choose a game token
- `begin-game` - Begin gameplay (host only)
- `roll-dice` - Roll dice on turn
- `buy-property` - Purchase a property
- `end-turn` - End current turn

#### Server to Client
- `lobby-created` - Confirmation of lobby creation
- `lobby-joined` - Confirmation of joining
- `game-starting` - Game initialization
- `token-selected` - Token selection update
- `all-tokens-selected` - All players ready
- `game-started` - Game begins
- `dice-rolled` - Dice roll result
- `turn-ended` - Turn change notification
- `property-purchased` - Property purchase update

### REST API
- `GET /api/lobbies` - List available lobbies
- `GET /api/games/:roomId` - Get game state
- `GET /health` - Health check

## Configuration

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=10000

# Frontend
REACT_APP_SERVER_URL=https://your-backend.onrender.com
```

### Game Settings

```javascript
const GAME_CONFIG = {
  maxPlayers: 8,
  minPlayers: 2,
  startingMoney: 5000,
  maxReconnectTime: 30000, // 30 seconds
  turnTimeout: 60000 // 60 seconds
};
```

## Security Features

- **Input Validation**: All client inputs are validated server-side
- **Turn Validation**: Only current player can perform actions
- **Session Management**: Secure player session handling
- **Rate Limiting**: Built-in protection against spam
- **CORS Configuration**: Proper cross-origin settings

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check server URL configuration
   - Verify CORS settings
   - Ensure WebSocket support

2. **Game State Sync Issues**
   - Check server logs
   - Clear browser cache

3. **Player Disconnections**
   - Check network stability
   - Verify reconnection logic
   - Monitor server resources

### Debug Mode

Enable debug logging:
```javascript
const DEBUG = true; // In server.js
```

### Logs

Check Render logs for backend issues:
```bash
# In Render dashboard
# View logs for your web service
```

## Performance Optimization

- **In-Memory Caching**: Game state cached in server memory
- **Memory Management**: Automatic cleanup of inactive games
- **CDN**: Static assets served via Netlify CDN

## Future Enhancements

- [ ] AI players for incomplete games
- [ ] Tournament mode
- [ ] Custom game rules
- [ ] Mobile app
- [ ] Voice chat integration
- [ ] Game replays
- [ ] Leaderboards
- [ ] Custom boards and themes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review server logs for errors 