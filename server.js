const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration for REST and Socket.IO
const allowedOrigins = [
    'https://metropoly-lv.netlify.app',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000'
];
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Preflight requests
app.options('*', cors());

// Socket.IO CORS config

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
const rooms = new Map();
const players = new Map();

// Room management
class GameRoom {
    constructor(roomId, hostId) {
        this.roomId = roomId;
        this.hostId = hostId;
        this.players = new Map();
        this.gameState = {
            status: 'lobby', // lobby, playing, finished
            currentTurn: 0,
            gameStarted: false,
            playerTokens: {},
            gameData: null
        };
        this.maxPlayers = 4;
        this.minPlayers = 2;
    }

    addPlayer(playerId, playerName, socketId) {
        // Check if player already exists in the room
        const existingPlayer = this.players.get(playerId);
        if (existingPlayer) {
            // Player exists, just update their Socket.IO connection
            existingPlayer.socketId = socketId;
            return true;
        }

        // Check if room is full
        if (this.players.size >= this.maxPlayers) {
            return false;
        }

        // Add new player
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            socketId: socketId,
            token: null,
            ready: false,
            isHost: playerId === this.hostId
        });

        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        
        // If host leaves, assign new host
        if (playerId === this.hostId && this.players.size > 0) {
            const newHost = this.players.values().next().value;
            this.hostId = newHost.id;
            newHost.isHost = true;
        }
        
        // If room is empty, mark for deletion
        if (this.players.size === 0) {
            return true; // Room should be deleted
        }
        
        return false;
    }

    selectToken(playerId, tokenName) {
        const player = this.players.get(playerId);
        if (player) {
            // Check if token is already taken
            const tokenTaken = Array.from(this.players.values()).some(p => p.token === tokenName);
            if (tokenTaken) {
                return false;
            }
            
            player.token = tokenName;
            this.gameState.playerTokens[playerId] = tokenName;
            return true;
        }
        return false;
    }

    setPlayerReady(playerId, ready) {
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Setting player ${playerId} (${player.name}) ready status from ${player.ready} to ${ready}`);
            player.ready = ready;
            console.log(`Player ${playerId} ready status updated successfully`);
        } else {
            console.error(`Player ${playerId} not found in room ${this.roomId}`);
        }
    }

    canStartGame() {
        const readyPlayers = Array.from(this.players.values()).filter(p => p.ready && p.token);
        return readyPlayers.length >= this.minPlayers && readyPlayers.length <= this.maxPlayers;
    }

    startGame() {
        if (!this.canStartGame()) {
            return false;
        }
        
        this.gameState.status = 'playing';
        this.gameState.gameStarted = true;
        
        // Initialize game data with proper token mapping
        const readyPlayers = Array.from(this.players.values()).filter(p => p.ready && p.token);
        this.gameState.gameData = {
            players: readyPlayers.map((p, index) => ({
                id: p.id,
                name: p.name,
                token: p.token,
                playerIndex: index, // Add player index for video chat
                position: 0,
                money: 5000, // Start with $5000 like the original game
                properties: [],
                inJail: false,
                jailTurns: 0,
                isHost: p.isHost,
                hasGetOutOfJailFree: false
            })),
            currentPlayerIndex: 0,
            properties: this.initializeProperties(),
            chanceCards: this.initializeChanceCards(),
            communityCards: this.initializeCommunityCards(),
            playerCount: readyPlayers.length,
            gameBoard: this.initializeGameBoard()
        };
        
        // Broadcast game started with complete player info
        this.broadcast({
            type: 'game_started',
            gameState: this.gameState,
            players: this.gameState.gameData.players
        });
        
        return true;
    }

    initializeProperties() {
        // Simplified property initialization
        return [
            { name: "Mediterranean Avenue", price: 60, rent: 2, owner: null },
            { name: "Baltic Avenue", price: 80, rent: 4, owner: null },
            { name: "Oriental Avenue", price: 100, rent: 6, owner: null },
            { name: "Vermont Avenue", price: 100, rent: 6, owner: null },
            { name: "Connecticut Avenue", price: 120, rent: 8, owner: null },
            { name: "St. Charles Place", price: 140, rent: 10, owner: null },
            { name: "States Avenue", price: 140, rent: 10, owner: null },
            { name: "Virginia Avenue", price: 160, rent: 12, owner: null },
            { name: "St. James Place", price: 180, rent: 14, owner: null },
            { name: "Tennessee Avenue", price: 180, rent: 14, owner: null },
            { name: "New York Avenue", price: 200, rent: 16, owner: null },
            { name: "Kentucky Avenue", price: 220, rent: 18, owner: null },
            { name: "Indiana Avenue", price: 220, rent: 18, owner: null },
            { name: "Illinois Avenue", price: 240, rent: 20, owner: null },
            { name: "Atlantic Avenue", price: 260, rent: 22, owner: null },
            { name: "Ventnor Avenue", price: 260, rent: 22, owner: null },
            { name: "Marvin Gardens", price: 280, rent: 24, owner: null },
            { name: "Pacific Avenue", price: 300, rent: 26, owner: null },
            { name: "North Carolina Avenue", price: 300, rent: 26, owner: null },
            { name: "Pennsylvania Avenue", price: 320, rent: 28, owner: null },
            { name: "Park Place", price: 350, rent: 35, owner: null },
            { name: "Boardwalk", price: 400, rent: 50, owner: null }
        ];
    }

    initializeChanceCards() {
        return [
            "Advance to Go (Collect $200)",
            "Advance to Illinois Ave",
            "Advance to St. Charles Place",
            "Advance to nearest Utility",
            "Advance to nearest Railroad",
            "Bank pays you dividend of $50",
            "Get out of Jail Free",
            "Go Back 3 Spaces",
            "Go to Jail",
            "Make general repairs on all your property",
            "Pay poor tax of $15",
            "Take a trip to Reading Railroad",
            "Take a walk on the Boardwalk",
            "You have been elected Chairman of the Board",
            "Your building loan matures"
        ];
    }

    initializeGameBoard() {
        // Initialize the game board with Las Vegas properties
        return [
            { name: "GO", type: "special", position: 0 },
            { name: "Las Vegas Raiders", price: 100, rent: 10, position: 1, color: "brown" },
            { name: "Community Cards", type: "special", position: 2 },
            { name: "Las Vegas Grand Prix", price: 120, rent: 12, position: 3, color: "brown" },
            { name: "Income Tax", type: "tax", price: 200, position: 4 },
            { name: "Las Vegas Monorail", price: 200, rent: 25, position: 5, type: "railroad" },
            { name: "Speed Vegas Off Roading", price: 140, rent: 14, position: 6, color: "lightblue" },
            { name: "Chance", type: "special", position: 7 },
            { name: "Las Vegas Golden Knights", price: 160, rent: 16, position: 8, color: "lightblue" },
            { name: "JAIL", type: "special", position: 9 },
            { name: "Maverick Helicopter Rides", price: 220, rent: 22, position: 10, color: "pink" },
            { name: "Brothel", price: 1500, rent: 300, position: 11, color: "pink" },
            { name: "Electric Company", price: 150, rent: 0, position: 12, type: "utility" },
            { name: "Bet MGM", price: 2500, rent: 200, position: 13, color: "pink" },
            { name: "Bellagio", price: 2500, rent: 200, position: 14, color: "orange" },
            { name: "Las Vegas Aces", price: 2500, rent: 200, position: 15, color: "orange" },
            { name: "Community Cards", type: "special", position: 16 },
            { name: "FREE PARKING", type: "special", position: 17 },
            { name: "Horseback Riding", price: 340, rent: 34, position: 18, color: "orange" },
            { name: "Resorts World Theatre", price: 300, rent: 0, position: 19, color: "red" },
            { name: "Chance", type: "special", position: 20 },
            { name: "Hard Rock Hotel", price: 2500, rent: 200, position: 21, color: "red" },
            { name: "Wynn Las Vegas", price: 2500, rent: 200, position: 22, color: "yellow" },
            { name: "Shriners Children's Open", price: 460, rent: 46, position: 23, color: "yellow" },
            { name: "Bachelor & Bachelorette Parties", price: 300, rent: 30, position: 24, color: "purple" },
            { name: "Las Vegas Little White Wedding Chapel", price: 200, rent: 20, position: 25, color: "white" },
            { name: "Sphere", price: 480, rent: 0, position: 26, color: "yellow" },
            { name: "Community Cards", type: "special", position: 27 },
            { name: "GO TO JAIL", type: "special", position: 28 },
            { name: "Caesars Palace", price: 2500, rent: 200, position: 29, color: "green" },
            { name: "Santa Fe Hotel and Casino", price: 2500, rent: 200, position: 30, color: "green" },
            { name: "Chance", type: "special", position: 31 },
            { name: "Luxury Tax", type: "tax", price: 75, position: 32 },
            { name: "House of Blues", price: 2500, rent: 200, position: 33, color: "blue" },
            { name: "Water Works", price: 150, rent: 0, position: 34, type: "utility" },
            { name: "The Cosmopolitan", price: 2500, rent: 200, position: 35, color: "blue" },
            { name: "Community Cards", type: "special", position: 36 },
            { name: "Las Vegas Aces", price: 320, rent: 32, position: 37, color: "orange" },
            { name: "Las Vegas Monorail", price: 200, rent: 25, position: 38, type: "railroad" },
            { name: "Speed Vegas Off Roading", price: 140, rent: 14, position: 39, color: "lightblue" },
            { name: "Chance", type: "special", position: 40 },
            { name: "Las Vegas Golden Knights", price: 160, rent: 16, position: 41, color: "lightblue" }
        ];
    }

    initializeCommunityCards() {
        return [
            "Advance to Go (Collect $200)",
            "Bank error in your favor. Collect $200",
            "Doctor's fee. Pay $50",
            "From sale of stock you get $50",
            "Get Out of Jail Free",
            "Go to Jail",
            "Holiday fund matures. Receive $100",
            "Income tax refund. Collect $20",
            "It is your birthday. Collect $10 from every player",
            "Life insurance matures. Collect $100",
            "Pay hospital fees of $100",
            "Pay school fees of $50",
            "Receive $25 consultancy fee",
            "You are assessed for street repair",
            "You have won second prize in a beauty contest. Collect $10",
            "You inherit $100"
        ];
    }

    broadcast(message, excludePlayerId = null) {
        // Use Socket.IO to emit to each player's socketId
        this.players.forEach((player, playerId) => {
            if (playerId !== excludePlayerId && player.socketId) {
                io.to(player.socketId).emit('lobby_data', message);
            }
        });
    // Also broadcast to all sockets in the room (including host)
    io.to(this.roomId).emit('lobby_data', message);
    }

    getRoomInfo() {
        return {
            roomId: this.roomId,
            hostId: this.hostId,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                token: p.token,
                ready: p.ready,
                isHost: p.isHost
            })),
            gameState: this.gameState,
            canStart: this.canStartGame()
        };
    }
}

// WebSocket server with error handling
const io = new Server(server, {
    cors: {
        origin: [
            'https://metropoly-lv.netlify.app',
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:5500',
            'http://127.0.0.1:3000'
        ],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('New Socket.IO connection:', socket.id);

    // Listen for all lobby/game messages from client
    socket.on('lobby_data', (data) => {
        // Attach socketId to player for tracking
        if (data.playerId) {
            if (!players.has(data.playerId)) {
                players.set(data.playerId, { socketId: socket.id, roomId: data.roomId, name: data.playerName });
            } else {
                const info = players.get(data.playerId);
                info.socketId = socket.id;
                info.roomId = data.roomId || info.roomId;
                info.name = data.playerName || info.name;
            }
        }
        // Route by type
        switch (data.type) {
            case 'create_room':
                handleCreateRoom(socket, data);
                break;
            case 'join_room':
                handleJoinRoom(socket, data);
                break;
            case 'select_token':
                handleSelectToken(socket, data, data.playerId);
                break;
            case 'set_ready':
                handleSetReady(socket, data, data.playerId);
                break;
            case 'start_game':
                handleStartGame(socket, data, data.playerId);
                break;
            case 'game_action':
                handleGameAction(socket, data, data.playerId);
                break;
            case 'leave_room':
                handleLeaveRoom(socket, data, data.playerId);
                break;
            case 'rejoin_game':
                handleRejoinGame(socket, data, data.playerId);
                break;
            case 'request_next_turn':
                handleRequestNextTurn(socket, data, data.playerId);
                break;
            case 'request_game_state':
                handleRequestGameState(socket, data, data.playerId);
                break;
            case 'game_transition_ready':
                handleGameTransitionReady(socket, data, data.playerId);
                break;
            default:
                socket.emit('error', { message: 'Unknown lobby_data type' });
        }

        // After handling, emit player connection status to all clients in the room
        if (data.roomId) {
            const room = rooms.get(data.roomId);
            if (room) {
                const activePlayers = Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    connected: !!players.get(p.id)?.socketId
                }));
                io.to(data.roomId).emit('player_status', { roomId: data.roomId, players: activePlayers });
            }
        }
    });

    // Join the socket.io room for multiplayer sync
    socket.on('join_room', (data) => {
        if (data.roomId) {
            socket.join(data.roomId);
        }
    });

    socket.on('disconnect', () => {
        // Find the player ID for this socket connection
        let playerId = null;
        for (const [pid, playerInfo] of players.entries()) {
            if (playerInfo.socketId === socket.id) {
                playerId = pid;
                break;
            }
        }
        if (playerId) {
            const playerInfo = players.get(playerId);
            if (playerInfo) {
                const room = rooms.get(playerInfo.roomId);
                if (room) {
                    if (room.gameState.status === 'playing') {
                        console.log(`[DISCONNECT] Player ${playerId} disconnected during game, keeping in room for rejoin.`);
                        const roomPlayer = room.players.get(playerId);
                        if (roomPlayer) {
                            roomPlayer.socketId = null;
                        }
                        console.log(`[DISCONNECT] Room state after disconnect:`, room.getRoomInfo());
                        return;
                    }
                    const shouldDelete = room.removePlayer(playerId);
                    if (shouldDelete) {
                        rooms.delete(playerInfo.roomId);
                        console.log(`[DISCONNECT] Room ${playerInfo.roomId} deleted after last player left.`);
                    } else {
                        room.broadcast({
                            type: 'player_left',
                            playerId: playerId,
                            roomInfo: room.getRoomInfo()
                        });
                        console.log(`[DISCONNECT] Player ${playerId} removed from room ${playerInfo.roomId}. Room state:`, room.getRoomInfo());
                    }
                }
            }
            players.delete(playerId);
            console.log(`[DISCONNECT] Player ${playerId} removed from global players map.`);
        }
    });
});

// Periodic cleanup of stale players (every 60 seconds)
setInterval(() => {
    for (const [roomId, room] of rooms.entries()) {
        if (room.gameState.status !== 'playing') {
            // Remove players with null socketId
            for (const [playerId, player] of room.players.entries()) {
                if (!player.socketId) {
                    console.log(`[CLEANUP] Removing stale player ${playerId} from room ${roomId}`);
                    room.removePlayer(playerId);
                    players.delete(playerId);
                }
            }
            // If room is empty, delete it
            if (room.players.size === 0) {
                console.log(`[CLEANUP] Deleting empty room ${roomId}`);
                rooms.delete(roomId);
            }
        }
    }
}, 60000);

function handleJoinRoom(ws, data) {
    const { roomId, playerName, playerId } = data;
    const room = rooms.get(roomId);

    if (!room) {
        io.to(ws.id).emit('lobby_data', {
            type: 'error',
            message: 'Room not found'
        });
        return;
    }

    // If playerId is provided and exists, update socketId and allow join
    if (playerId && room.players.has(playerId)) {
        console.log(`[JOIN] Player ${playerId} already in room ${roomId}, updating socketId.`);
        room.players.get(playerId).socketId = ws.id;
        players.set(playerId, { socketId: ws.id, roomId, name: playerName });
        if (ws && ws.join) ws.join(roomId);
        io.to(ws.id).emit('lobby_data', {
            type: 'joined_room',
            playerId: playerId,
            roomInfo: room.getRoomInfo()
        });
        room.broadcast({
            type: 'player_joined',
            playerId: playerId,
            playerName: playerName,
            roomInfo: room.getRoomInfo()
        }, playerId);
        console.log(`[JOIN] Updated player ${playerId} socketId and broadcasted join.`);
        return;
    }

    if (room.players.size >= room.maxPlayers) {
        console.log(`[JOIN] Room ${roomId} is full. Current players:`, Array.from(room.players.keys()));
        io.to(ws.id).emit('lobby_data', {
            type: 'error',
            message: 'Room is full'
        });
        return;
    }
    const newPlayerId = playerId || generatePlayerId();
    players.set(newPlayerId, { socketId: ws.id, roomId, name: playerName });
    const success = room.addPlayer(newPlayerId, playerName, ws.id);
    if (success) {
        if (ws && ws.join) ws.join(roomId);
        io.to(ws.id).emit('lobby_data', {
            type: 'joined_room',
            playerId: newPlayerId,
            roomInfo: room.getRoomInfo()
        });
        room.broadcast({
            type: 'player_joined',
            playerId: newPlayerId,
            playerName: playerName,
            roomInfo: room.getRoomInfo()
        }, newPlayerId);
        console.log(`[JOIN] New player ${newPlayerId} joined room ${roomId}.`);
    }
}

function handleCreateRoom(ws, data) {
    const { playerName } = data;
    const roomId = generateRoomId();
    const newPlayerId = generatePlayerId();

    const room = new GameRoom(roomId, newPlayerId);
    rooms.set(roomId, room);

    // Update the player tracking with name
    players.set(newPlayerId, { socketId: ws.id, roomId, name: playerName });

    room.addPlayer(newPlayerId, playerName, ws.id);

    // Host socket joins the Socket.IO room
    if (ws && ws.join) ws.join(roomId);

    io.to(ws.id).emit('lobby_data', {
        type: 'room_created',
        roomId: roomId,
        playerId: newPlayerId,
        roomInfo: room.getRoomInfo()
    });

    // Immediately broadcast initial room state to all sockets in the room
    room.broadcast({
        type: 'player_joined',
        playerId: newPlayerId,
        playerName: playerName,
        roomInfo: room.getRoomInfo()
    });
}

function handleSelectToken(ws, data, playerId) {
    const { tokenName } = data;
    
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    const success = room.selectToken(playerId, tokenName);
    if (success) {
        room.broadcast({
            type: 'token_selected',
            playerId: playerId,
            tokenName: tokenName,
            roomInfo: room.getRoomInfo()
        });
    } else {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Token already taken or invalid selection'
        }));
    }
}

function handleSetReady(ws, data, playerId) {
    const { ready } = data;
    console.log(`Player ${playerId} setting ready status to: ${ready}`);

    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        console.error('Player not found:', playerId);
        if (ws && ws.id) io.to(ws.id).emit('lobby_data', {
            type: 'error',
            message: 'Player not found'
        });
        return;
    }

    const room = rooms.get(playerInfo.roomId);
    if (!room) {
        console.error('Room not found for player:', playerId);
        if (ws && ws.id) io.to(ws.id).emit('lobby_data', {
            type: 'error',
            message: 'Room not found'
        });
        return;
    }

    // Set the player's ready status
    room.setPlayerReady(playerId, ready);
    console.log(`Player ${playerId} ready status set to ${ready}`);

    // Get updated room info
    const roomInfo = room.getRoomInfo();
    console.log('Updated room info:', roomInfo);

    // Broadcast the change to all players in the room
    room.broadcast({
        type: 'player_ready_changed',
        playerId: playerId,
        ready: ready,
        roomInfo: roomInfo
    });
    
    console.log(`Broadcasted ready change for player ${playerId} to all players in room ${room.roomId}`);
}

function handleStartGame(ws, data, playerId) {
    console.log(`Start game request from player ${playerId}`);
    
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        console.log(`Player ${playerId} not found in players map`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (!room) {
        console.log(`Room ${playerInfo.roomId} not found`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    if (room.hostId !== playerId) {
        console.log(`Player ${playerId} is not the host (host is ${room.hostId})`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Only the host can start the game'
        }));
        return;
    }
    
    console.log(`Starting game for room ${room.roomId}`);
    const success = room.startGame();
    if (success) {
        console.log(`Game started successfully, broadcasting to ${room.players.size} players`);
        
        // Send comprehensive game state update to all players
        const gameStateMessage = {
            type: 'game_state_update',
            gameState: room.gameState,
            players: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                token: p.token,
                money: 1500, // Default money
                position: 0
            })),
            currentPlayerIndex: room.gameState.currentTurn,
            currentPlayerId: room.gameState.gameData?.players?.[room.gameState.currentTurn]?.id || null,
            message: 'Game started!'
        };
        
        console.log('Broadcasting game state update:', gameStateMessage);
        room.broadcast(gameStateMessage);
        
        // Also send game started message for compatibility
        const gameStartedMessage = {
            type: 'game_started',
            gameState: room.gameState,
            players: gameStateMessage.players,
            currentPlayerIndex: gameStateMessage.currentPlayerIndex,
            currentPlayerId: gameStateMessage.currentPlayerId
        };
        
        console.log('Broadcasting game started message:', gameStartedMessage);
        room.broadcast(gameStartedMessage);
    } else {
        console.log(`Failed to start game - not enough ready players`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Cannot start game - not enough ready players'
        }));
    }
}

function handleGameAction(ws, data, playerId) {
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (!room || room.gameState.status !== 'playing') {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game not in progress'
        }));
        return;
    }
    
    // Check if it's the player's turn
    const currentPlayer = room.gameState.gameData.players[room.gameState.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Not your turn'
        }));
        return;
    }
    
    // Handle specific game actions
    switch (data.action) {
        case 'roll_dice':
            handleDiceRoll(room, playerId, data);
            break;
        case 'buy_property':
            handleBuyProperty(room, playerId, data);
            break;
        case 'end_turn':
            handleEndTurn(room, playerId);
            break;
        case 'pay_rent':
            handlePayRent(room, playerId, data);
            break;
        default:
            // Broadcast generic game action
            room.broadcast({
                type: 'game_action',
                playerId: playerId,
                action: data.action,
                data: data.data
            });
    }
}

function handleDiceRoll(room, playerId, data) {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    
    // Get current player
    const player = room.gameState.gameData.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Store the current position before updating
    const fromPosition = player.position;
    
    // Update player position
    const newPosition = (player.position + total) % 42; // Using 42 spaces on board
    const passedGo = newPosition < player.position;
    
    player.position = newPosition;
    
    // Add money if passed Go
    if (passedGo) {
        player.money += 200;
    }
    
    // Broadcast dice roll result with fromPosition
    room.broadcast({
        type: 'dice_rolled',
        playerId: playerId,
        playerName: player.name,
        dice1: dice1,
        dice2: dice2,
        total: total,
        fromPosition: fromPosition,
        newPosition: newPosition,
        passedGo: passedGo,
        newMoney: player.money
    });
}

function handleBuyProperty(room, playerId, data) {
    const player = room.gameState.gameData.players.find(p => p.id === playerId);
    const property = room.gameState.gameData.properties.find(p => p.name === data.propertyName);
    
    if (!player || !property) return;
    
    if (property.owner) {
        room.broadcast({
            type: 'property_already_owned',
            playerId: playerId,
            propertyName: data.propertyName
        });
        return;
    }
    
    if (player.money >= property.price) {
        player.money -= property.price;
        property.owner = playerId;
        player.properties.push(data.propertyName);
        
        room.broadcast({
            type: 'property_purchased',
            playerId: playerId,
            playerName: player.name,
            propertyName: data.propertyName,
            price: property.price,
            newMoney: player.money
        });
    } else {
        room.broadcast({
            type: 'insufficient_funds',
            playerId: playerId,
            propertyName: data.propertyName,
            required: property.price,
            available: player.money
        });
    }
}

function handleEndTurn(room, playerId) {
    // Move to next player
    const nextPlayerIndex = (room.gameState.currentPlayerIndex + 1) % room.gameState.gameData.players.length;
    room.gameState.currentPlayerIndex = nextPlayerIndex;
    
    const nextPlayer = room.gameState.gameData.players[nextPlayerIndex];
    
    room.broadcast({
        type: 'turn_ended',
        playerId: playerId,
        nextPlayerId: nextPlayer.id,
        nextPlayerName: nextPlayer.name,
        currentPlayerIndex: nextPlayerIndex
    });
}

function handlePayRent(room, playerId, data) {
    const player = room.gameState.gameData.players.find(p => p.id === playerId);
    const property = room.gameState.gameData.properties.find(p => p.name === data.propertyName);
    const owner = room.gameState.gameData.players.find(p => p.id === property.owner);
    
    if (!player || !property || !owner) return;
    
    const rent = property.rent;
    
    if (player.money >= rent) {
        player.money -= rent;
        owner.money += rent;
        
        room.broadcast({
            type: 'rent_paid',
            playerId: playerId,
            playerName: player.name,
            ownerId: owner.id,
            ownerName: owner.name,
            propertyName: data.propertyName,
            rent: rent,
            playerNewMoney: player.money,
            ownerNewMoney: owner.money
        });
    } else {
        room.broadcast({
            type: 'insufficient_funds_for_rent',
            playerId: playerId,
            propertyName: data.propertyName,
            rent: rent,
            available: player.money
        });
    }
}

function handleLeaveRoom(ws, data, playerId) {
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (room) {
        const shouldDelete = room.removePlayer(playerId);
        if (shouldDelete) {
            rooms.delete(playerInfo.roomId);
        } else {
            room.broadcast({
                type: 'player_left',
                playerId: playerId,
                roomInfo: room.getRoomInfo()
            });
        }
    }
    
    players.delete(playerId);
}

function handleRejoinGame(ws, data, playerId) {
    const { roomId, playerId: rejoinPlayerId, storedState } = data;
    console.log(`Rejoin game request: roomId=${roomId}, playerId=${rejoinPlayerId}`);
    console.log(`Available rooms:`, Array.from(rooms.keys()));
    console.log(`Room ${roomId} exists:`, rooms.has(roomId));
    
    const room = rooms.get(roomId);
    
    if (!room) {
        console.log(`Room ${roomId} not found. Attempting to recreate from stored state...`);
        // Try to recreate the room if storedState is provided
        if (storedState) {
            // Create new GameRoom instance
            const newRoom = new GameRoom(roomId, rejoinPlayerId);
            // Restore game state if available
            if (storedState.gameState) {
                newRoom.gameState = storedState.gameState;
            }
            // Restore player info
            const recoveredPlayer = {
                id: rejoinPlayerId,
                name: storedState.playerName || 'Unknown Player',
                ws: ws,
                token: storedState.selectedToken || null,
                ready: true,
                isHost: true
            };
            newRoom.players.set(rejoinPlayerId, recoveredPlayer);
            rooms.set(roomId, newRoom);
            players.set(rejoinPlayerId, { ws, roomId, name: recoveredPlayer.name });
            // Send game state update
            const gameStateMessage = {
                type: 'game_state_update',
                gameState: newRoom.gameState,
                players: Array.from(newRoom.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    token: p.token,
                    money: newRoom.gameState?.gameData?.players?.find(gp => gp.id === p.id)?.money || 1500,
                    position: newRoom.gameState?.gameData?.players?.find(gp => gp.id === p.id)?.position || 0
                })),
                currentPlayerIndex: newRoom.gameState?.currentTurn || 0,
                currentPlayerId: newRoom.gameState?.gameData?.players?.[newRoom.gameState?.currentTurn]?.id || null
            };
            console.log(`Recreated room and sending game state update:`, gameStateMessage);
            ws.send(JSON.stringify(gameStateMessage));
            return;
        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Game room not found and no stored state to recover.'
            }));
            return;
        }
    }
    
    console.log(`Room found, game state status: ${room.gameState.status}`);
    console.log(`Room players count: ${room.players.size}`);
    
    console.log(`Room found, checking for player ${rejoinPlayerId} in room`);
    console.log(`Room players:`, Array.from(room.players.keys()));
    
    // Check if player was already in this room
    const existingPlayer = room.players.get(rejoinPlayerId);
    if (existingPlayer) {
        console.log(`Player ${rejoinPlayerId} found in room, updating connection`);
        console.log(`Player name: ${existingPlayer.name}, token: ${existingPlayer.token}`);
        
        // Update the WebSocket connection
        existingPlayer.ws = ws;
        playerId = rejoinPlayerId;
        players.set(playerId, { ws, roomId, name: existingPlayer.name });
        
        console.log(`Updated player connection for ${rejoinPlayerId}`);
        
        // Send current game state
        const gameStateMessage = {
            type: 'game_state_update',
            gameState: room.gameState,
            players: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                token: p.token,
                money: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.money || 1500,
                position: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.position || 0
            })),
            currentPlayerIndex: room.gameState.currentTurn,
            currentPlayerId: room.gameState.gameData?.players?.[room.gameState.currentTurn]?.id || null
        };
        
        console.log(`Sending game state update:`, gameStateMessage);
        ws.send(JSON.stringify(gameStateMessage));
        
        // Notify other players about the rejoin
        room.broadcast({
            type: 'player_rejoined',
            playerId: rejoinPlayerId,
            playerName: existingPlayer.name
        }, rejoinPlayerId);
        
    } else {
        // Player not found in room, try to recover from stored state or global players
        console.log(`Player ${rejoinPlayerId} not found in room, attempting recovery`);
        
        let recoveredPlayer = null;
        
        // Check global players map
        const globalPlayerInfo = players.get(rejoinPlayerId);
        if (globalPlayerInfo && globalPlayerInfo.roomId === roomId) {
            console.log(`Found player ${rejoinPlayerId} in global players map`);
            recoveredPlayer = {
                id: rejoinPlayerId,
                name: globalPlayerInfo.name || 'Unknown Player',
                ws: ws,
                token: null,
                ready: false,
                isHost: false
            };
        }
        
        // If we have stored state, use it for recovery
        if (!recoveredPlayer && storedState) {
            console.log(`Using stored state for player recovery:`, storedState);
            recoveredPlayer = {
                id: rejoinPlayerId,
                name: storedState.playerName || 'Unknown Player',
                ws: ws,
                token: storedState.selectedToken || null,
                ready: true, // Assume ready if they had stored state
                isHost: storedState.isHost || false
            };
        }
        
        if (recoveredPlayer) {
            console.log(`Recovering player:`, recoveredPlayer);
            room.players.set(rejoinPlayerId, recoveredPlayer);
            players.set(rejoinPlayerId, { ws, roomId, name: recoveredPlayer.name });
            
            // Send game state update
            const gameStateMessage = {
                type: 'game_state_update',
                gameState: room.gameState,
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    token: p.token,
                    money: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.money || 1500,
                    position: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.position || 0
                })),
                currentPlayerIndex: room.gameState.currentTurn,
                currentPlayerId: room.gameState.gameData?.players?.[room.gameState.currentTurn]?.id || null
            };
            
            console.log(`Sending recovered game state update:`, gameStateMessage);
            ws.send(JSON.stringify(gameStateMessage));
            
            // Notify other players about the recovery
            room.broadcast({
                type: 'player_recovered',
                playerId: rejoinPlayerId,
                playerName: recoveredPlayer.name
            }, rejoinPlayerId);
            
        } else {
            console.log(`Could not recover player ${rejoinPlayerId}`);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Player not found in game'
            }));
        }
    }
}

function handleRequestNextTurn(ws, data, playerId) {
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (!room || room.gameState.status !== 'playing') {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game not in progress'
        }));
        return;
    }
    
    // Move to next player
    const currentPlayer = room.gameState.gameData.players[room.gameState.currentTurn];
    const nextPlayerIndex = (room.gameState.currentTurn + 1) % room.gameState.gameData.players.length;
    const nextPlayer = room.gameState.gameData.players[nextPlayerIndex];
    
    room.gameState.currentTurn = nextPlayerIndex;
    
    // Broadcast turn change
    room.broadcast({
        type: 'player_turn',
        playerId: nextPlayer.id,
        playerName: nextPlayer.name,
        currentPlayerIndex: nextPlayerIndex
    });
}

function handleRequestGameState(ws, data, playerId) {
    console.log(`Game state request from player ${playerId}`);
    
    // Find the room this player is in
    const playerInfo = players.get(playerId);
    if (!playerInfo) {
        console.log(`Player ${playerId} not found in players map, checking all rooms...`);
        
        // Try to find the player in any room
        let foundRoom = null;
        let foundPlayer = null;
        
        for (const [roomId, room] of rooms.entries()) {
            const roomPlayer = room.players.get(playerId);
            if (roomPlayer) {
                foundRoom = room;
                foundPlayer = roomPlayer;
                console.log(`Found player ${playerId} in room ${roomId}`);
                break;
            }
        }
        
        if (foundRoom && foundPlayer) {
            // Add the player back to the global players map
            players.set(playerId, { ws, roomId: foundRoom.roomId, name: foundPlayer.name });
            
            // Update the player's WebSocket connection in the room
            foundPlayer.ws = ws;
            
            // Send the game state
            const gameStateMessage = {
                type: 'game_state_update',
                gameState: foundRoom.gameState,
                players: Array.from(foundRoom.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    token: p.token,
                    money: foundRoom.gameState.gameData?.players?.find(gp => gp.id === p.id)?.money || 1500,
                    position: foundRoom.gameState.gameData?.players?.find(gp => gp.id === p.id)?.position || 0
                })),
                currentPlayerIndex: foundRoom.gameState.currentTurn,
                currentPlayerId: foundRoom.gameState.gameData?.players?.[foundRoom.gameState.currentTurn]?.id || null,
                message: 'Game state recovered from room'
            };
            
            console.log('Sending recovered game state:', gameStateMessage);
            ws.send(JSON.stringify(gameStateMessage));
            return;
        }
        
        console.log(`Player ${playerId} not found in any room`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Player not found'
        }));
        return;
    }
    
    const room = rooms.get(playerInfo.roomId);
    if (!room) {
        console.log(`Room ${playerInfo.roomId} not found`);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    // Send current game state to the requesting player
    const gameStateMessage = {
        type: 'game_state_update',
        gameState: room.gameState,
        players: Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            token: p.token,
            money: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.money || 1500,
            position: room.gameState.gameData?.players?.find(gp => gp.id === p.id)?.position || 0
        })),
        currentPlayerIndex: room.gameState.currentTurn,
        currentPlayerId: room.gameState.gameData?.players?.[room.gameState.currentTurn]?.id || null,
        message: 'Game state requested'
    };
    
    console.log('Sending game state to requesting player:', gameStateMessage);
    ws.send(JSON.stringify(gameStateMessage));
}

function handleGameTransitionReady(ws, data, playerId) {
    const { roomId, playerId: transitionPlayerId } = data;
    console.log(`Game transition ready for player ${transitionPlayerId} in room ${roomId}`);
    
    const room = rooms.get(roomId);
    if (!room) {
        console.log(`Room ${roomId} not found for transition`);
        return;
    }
    
    const player = room.players.get(transitionPlayerId);
    if (player) {
        console.log(`Player ${transitionPlayerId} ready for game transition`);
        // Mark the player as ready for transition
        player.transitionReady = true;
        
        // Send acknowledgment
        ws.send(JSON.stringify({
            type: 'game_transition_ready_ack',
            playerId: transitionPlayerId,
            roomId: roomId
        }));
    }
}

// Utility functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

// API endpoints
app.get('/api/rooms', (req, res) => {
    try {
        console.log('GET /api/rooms - Request received');
        const roomList = Array.from(rooms.values()).map(room => ({
            roomId: room.roomId,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            status: room.gameState.status
        }));
        console.log('Sending room list:', roomList);
        res.json(roomList);
    } catch (error) {
        console.error('Error in /api/rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/room/:roomId', (req, res) => {
    try {
        console.log('GET /api/room/:roomId - Request received for room:', req.params.roomId);
        const room = rooms.get(req.params.roomId);
        if (room) {
            res.json(room.getRoomInfo());
        } else {
            res.status(404).json({ error: 'Room not found' });
        }
    } catch (error) {
        console.error('Error in /api/room/:roomId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    try {
        const healthData = { 
            status: 'ok', 
            rooms: rooms.size, 
            players: players.size,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
        console.log('Health check:', healthData);
        res.json(healthData);
    } catch (error) {
        console.error('Error in health check:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Vegas Metropoly Server is running',
        version: '1.0.0',
        endpoints: ['/api/rooms', '/api/room/:roomId', '/health']
    });
});

const PORT = process.env.PORT || 3000;

// Enhanced server startup
server.listen(PORT, () => {
    console.log(`🚀 Vegas Metropoly Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for connections`);
    console.log(`🌐 CORS enabled for: https://metropoly-lv.netlify.app`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
    console.log(`📋 API endpoints:`);
    console.log(`   - GET /api/rooms`);
    console.log(`   - GET /api/room/:roomId`);
    console.log(`   - GET /health`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error('Port is already in use. Please try a different port.');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});