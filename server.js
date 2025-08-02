const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Game state management
const games = new Map();
const lobbies = new Map();
const playerSessions = new Map();

// Game configuration
const GAME_CONFIG = {
  maxPlayers: 8,
  minPlayers: 2,
  startingMoney: 5000,
  maxReconnectTime: 30000, // 30 seconds
  turnTimeout: 60000 // 60 seconds
};

// Game state structure
class GameState {
  constructor(roomId, hostId) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.players = new Map();
    this.currentPlayerIndex = 0;
    this.gameStarted = false;
    this.gameEnded = false;
    this.turnTimeout = null;
    this.lastActivity = Date.now();
    this.properties = new Map();
    this.diceRolls = [];
    this.gameLog = [];
  }

  addPlayer(socketId, playerData) {
    if (this.players.size >= GAME_CONFIG.maxPlayers) {
      return false;
    }
    
    this.players.set(socketId, {
      id: socketId,
      name: playerData.name,
      token: playerData.token,
      money: GAME_CONFIG.startingMoney,
      properties: [],
      currentPosition: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      isConnected: true,
      lastSeen: Date.now(),
      isAI: false,
      ...playerData
    });
    
    return true;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.isConnected = false;
      player.lastSeen = Date.now();
    }
  }

  getCurrentPlayer() {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length === 0) return null;
    return this.players.get(playerIds[this.currentPlayerIndex]);
  }

  nextTurn() {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length === 0) return;
    
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playerIds.length;
    
    // Skip disconnected players
    let attempts = 0;
    while (attempts < playerIds.length) {
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer && currentPlayer.isConnected) {
        break;
      }
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playerIds.length;
      attempts++;
    }
  }

  getConnectedPlayers() {
    return Array.from(this.players.values()).filter(p => p.isConnected);
  }

  canStartGame() {
    return this.players.size >= GAME_CONFIG.minPlayers && 
           Array.from(this.players.values()).every(p => p.token);
  }

  toJSON() {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      currentPlayerIndex: this.currentPlayerIndex,
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded,
      properties: Array.from(this.properties.entries()),
      diceRolls: this.diceRolls,
      gameLog: this.gameLog
    };
  }
}

// Lobby management
class Lobby {
  constructor(roomId, hostId, hostName) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.hostName = hostName;
    this.players = new Map();
    this.createdAt = Date.now();
    this.maxPlayers = GAME_CONFIG.maxPlayers;
  }

  addPlayer(socketId, playerName) {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    
    this.players.set(socketId, {
      id: socketId,
      name: playerName,
      isHost: socketId === this.hostId,
      joinedAt: Date.now()
    });
    
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    
    // If host left, assign new host
    if (socketId === this.hostId && this.players.size > 0) {
      const newHost = this.players.values().next().value;
      this.hostId = newHost.id;
      newHost.isHost = true;
    }
  }

  toJSON() {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      hostName: this.hostName,
      players: Array.from(this.players.values()),
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      createdAt: this.createdAt
    };
  }
}

// Utility functions
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Join lobby
  socket.on('create-lobby', async (data) => {
    try {
      const roomId = generateRoomId();
      const lobby = new Lobby(roomId, socket.id, data.playerName);
      
      lobby.addPlayer(socket.id, data.playerName);
      lobbies.set(roomId, lobby);
      
      socket.join(roomId);
      socket.emit('lobby-created', lobby.toJSON());
      
      // Store player session
      playerSessions.set(socket.id, { roomId, isInGame: false });
      
      console.log(`Lobby created: ${roomId} by ${data.playerName}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create lobby' });
    }
  });

  socket.on('join-lobby', async (data) => {
    try {
      const lobby = lobbies.get(data.roomId);
      
      if (!lobby) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }
      
      if (lobby.players.size >= lobby.maxPlayers) {
        socket.emit('error', { message: 'Lobby is full' });
        return;
      }
      
      if (!lobby.addPlayer(socket.id, data.playerName)) {
        socket.emit('error', { message: 'Failed to join lobby' });
        return;
      }
      
      socket.join(data.roomId);
      socket.emit('lobby-joined', lobby.toJSON());
      socket.to(data.roomId).emit('player-joined', {
        id: socket.id,
        name: data.playerName
      });
      
      // Store player session
      playerSessions.set(socket.id, { roomId: data.roomId, isInGame: false });
      
      console.log(`Player ${data.playerName} joined lobby ${data.roomId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to join lobby' });
    }
  });

  socket.on('start-game', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const lobby = lobbies.get(session.roomId);
      if (!lobby || lobby.hostId !== socket.id) {
        socket.emit('error', { message: 'Only host can start game' });
        return;
      }
      
      if (lobby.players.size < GAME_CONFIG.minPlayers) {
        socket.emit('error', { message: `Need at least ${GAME_CONFIG.minPlayers} players` });
        return;
      }
      
      // Create game state
      const gameState = new GameState(session.roomId, socket.id);
      
      // Add all players to game
      for (const [playerId, playerData] of lobby.players) {
        gameState.addPlayer(playerId, {
          name: playerData.name,
          token: null // Will be set during token selection
        });
      }
      
      games.set(session.roomId, gameState);
      
      // Notify all players
      io.to(session.roomId).emit('game-starting', {
        roomId: session.roomId,
        players: Array.from(gameState.players.values())
      });
      
      console.log(`Game starting in room ${session.roomId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  socket.on('select-token', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const gameState = games.get(session.roomId);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const player = gameState.players.get(socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      
      // Check if token is already taken
      const tokenTaken = Array.from(gameState.players.values())
        .some(p => p.token === data.token && p.id !== socket.id);
      
      if (tokenTaken) {
        socket.emit('error', { message: 'Token already taken' });
        return;
      }
      
      player.token = data.token;
      
      // Notify all players
      io.to(session.roomId).emit('token-selected', {
        playerId: socket.id,
        token: data.token
      });
      
      // Check if all players have selected tokens
      if (gameState.canStartGame()) {
        io.to(session.roomId).emit('all-tokens-selected');
      }
      
      console.log(`Player ${player.name} selected token: ${data.token}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to select token' });
    }
  });

  socket.on('begin-game', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const gameState = games.get(session.roomId);
      if (!gameState || gameState.hostId !== socket.id) {
        socket.emit('error', { message: 'Only host can begin game' });
        return;
      }
      
      if (!gameState.canStartGame()) {
        socket.emit('error', { message: 'Not all players have selected tokens' });
        return;
      }
      
      gameState.gameStarted = true;
      session.isInGame = true;
      
      // Initialize game properties and other state
      initializeGameProperties(gameState);
      
      // Start first turn
      const currentPlayer = gameState.getCurrentPlayer();
      if (currentPlayer) {
        io.to(session.roomId).emit('game-started', {
          gameState: gameState.toJSON(),
          currentPlayer: currentPlayer.id
        });
        
        startTurnTimer(gameState);
      }
      
      console.log(`Game began in room ${session.roomId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to begin game' });
    }
  });

  socket.on('roll-dice', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const gameState = games.get(session.roomId);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const currentPlayer = gameState.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.id !== socket.id) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }
      
      // Roll dice (1-6 for each die)
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      
      // Update player position
      const newPosition = (currentPlayer.currentPosition + total) % 40; // Assuming 40 spaces
      currentPlayer.currentPosition = newPosition;
      
      // Store dice roll
      gameState.diceRolls.push({
        playerId: socket.id,
        die1,
        die2,
        total,
        timestamp: Date.now()
      });
      
      // Clear turn timeout
      if (gameState.turnTimeout) {
        clearTimeout(gameState.turnTimeout);
        gameState.turnTimeout = null;
      }
      
      // Notify all players
      io.to(session.roomId).emit('dice-rolled', {
        playerId: socket.id,
        die1,
        die2,
        total,
        newPosition,
        gameState: gameState.toJSON()
      });
      
      console.log(`Player ${currentPlayer.name} rolled ${die1} + ${die2} = ${total}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to roll dice' });
    }
  });

  socket.on('end-turn', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const gameState = games.get(session.roomId);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const currentPlayer = gameState.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.id !== socket.id) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }
      
      // Clear turn timeout
      if (gameState.turnTimeout) {
        clearTimeout(gameState.turnTimeout);
        gameState.turnTimeout = null;
      }
      
      // Move to next turn
      gameState.nextTurn();
      const nextPlayer = gameState.getCurrentPlayer();
      
      // Notify all players
      io.to(session.roomId).emit('turn-ended', {
        nextPlayer: nextPlayer ? nextPlayer.id : null,
        gameState: gameState.toJSON()
      });
      
      // Start timer for next player
      if (nextPlayer) {
        startTurnTimer(gameState);
      }
      
      console.log(`Turn ended, next player: ${nextPlayer ? nextPlayer.name : 'None'}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to end turn' });
    }
  });

  socket.on('buy-property', async (data) => {
    try {
      const session = playerSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'No active session' });
        return;
      }
      
      const gameState = games.get(session.roomId);
      if (!gameState) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }
      
      const player = gameState.players.get(socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      
      const property = gameState.properties.get(data.propertyId);
      if (!property) {
        socket.emit('error', { message: 'Property not found' });
        return;
      }
      
      if (property.owner) {
        socket.emit('error', { message: 'Property already owned' });
        return;
      }
      
      if (player.money < property.price) {
        socket.emit('error', { message: 'Not enough money' });
        return;
      }
      
      // Purchase property
      player.money -= property.price;
      property.owner = socket.id;
      player.properties.push(data.propertyId);
      
      // Notify all players
      io.to(session.roomId).emit('property-purchased', {
        playerId: socket.id,
        propertyId: data.propertyId,
        gameState: gameState.toJSON()
      });
      
      console.log(`Player ${player.name} purchased property ${property.name}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to purchase property' });
    }
  });

  socket.on('disconnect', async () => {
    try {
      console.log(`Player disconnected: ${socket.id}`);
      
      const session = playerSessions.get(socket.id);
      if (session) {
        if (session.isInGame) {
          // Handle game disconnection
          const gameState = games.get(session.roomId);
          if (gameState) {
            gameState.removePlayer(socket.id);
            
            // Check if game should end
            const connectedPlayers = gameState.getConnectedPlayers();
            if (connectedPlayers.length < GAME_CONFIG.minPlayers) {
              io.to(session.roomId).emit('game-ended', {
                reason: 'Not enough players remaining'
              });
              games.delete(session.roomId);
            } else {
              // Notify other players
              io.to(session.roomId).emit('player-disconnected', {
                playerId: socket.id
              });
            }
          }
        } else {
          // Handle lobby disconnection
          const lobby = lobbies.get(session.roomId);
          if (lobby) {
            lobby.removePlayer(socket.id);
            
            if (lobby.players.size === 0) {
              lobbies.delete(session.roomId);
            } else {
              io.to(session.roomId).emit('lobby-updated', lobby.toJSON());
            }
          }
        }
      }
      
      playerSessions.delete(socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  socket.on('reconnect', async (data) => {
    try {
      const session = playerSessions.get(data.playerId);
      if (session && session.isInGame) {
        const gameState = games.get(session.roomId);
        if (gameState) {
          const player = gameState.players.get(data.playerId);
          if (player) {
            player.isConnected = true;
            player.lastSeen = Date.now();
            
            // Update session
            playerSessions.set(socket.id, session);
            playerSessions.delete(data.playerId);
            
            // Update player ID in game state
            gameState.players.set(socket.id, player);
            gameState.players.delete(data.playerId);
            
            socket.join(session.roomId);
            
            // Send current game state
            socket.emit('reconnected', {
              gameState: gameState.toJSON(),
              playerId: socket.id
            });
            
            // Notify other players
            socket.to(session.roomId).emit('player-reconnected', {
              oldPlayerId: data.playerId,
              newPlayerId: socket.id
            });
            
            console.log(`Player reconnected: ${data.playerId} -> ${socket.id}`);
          }
        }
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to reconnect' });
    }
  });
});

// Helper functions
function initializeGameProperties(gameState) {
  // Initialize basic property data
  const properties = [
    { id: 1, name: "Mediterranean Avenue", price: 60, rent: 2, color: "brown" },
    { id: 3, name: "Baltic Avenue", price: 60, rent: 4, color: "brown" },
    { id: 6, name: "Oriental Avenue", price: 100, rent: 6, color: "lightblue" },
    { id: 8, name: "Vermont Avenue", price: 100, rent: 6, color: "lightblue" },
    { id: 9, name: "Connecticut Avenue", price: 120, rent: 8, color: "lightblue" },
    // Add more properties as needed
  ];
  
  properties.forEach(prop => {
    gameState.properties.set(prop.id, {
      ...prop,
      owner: null,
      houses: 0,
      hotels: 0,
      mortgaged: false
    });
  });
}

function startTurnTimer(gameState) {
  if (gameState.turnTimeout) {
    clearTimeout(gameState.turnTimeout);
  }
  
  gameState.turnTimeout = setTimeout(() => {
    // Auto-end turn if timeout
    const currentPlayer = gameState.getCurrentPlayer();
    if (currentPlayer) {
      console.log(`Turn timeout for player ${currentPlayer.name}`);
      gameState.nextTurn();
      const nextPlayer = gameState.getCurrentPlayer();
      
      io.to(gameState.roomId).emit('turn-timeout', {
        playerId: currentPlayer.id,
        nextPlayer: nextPlayer ? nextPlayer.id : null,
        gameState: gameState.toJSON()
      });
      
      if (nextPlayer) {
        startTurnTimer(gameState);
      }
    }
  }, GAME_CONFIG.turnTimeout);
}

// API routes
app.get('/api/lobbies', (req, res) => {
  const lobbyList = Array.from(lobbies.values()).map(lobby => ({
    roomId: lobby.roomId,
    hostName: lobby.hostName,
    playerCount: lobby.players.size,
    maxPlayers: lobby.maxPlayers,
    createdAt: lobby.createdAt
  }));
  
  res.json(lobbyList);
});

app.get('/api/games/:roomId', (req, res) => {
  const gameState = games.get(req.params.roomId);
  if (!gameState) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(gameState.toJSON());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lobbies: lobbies.size, 
    games: games.size,
    connections: io.engine.clientsCount 
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 