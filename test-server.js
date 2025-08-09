// Simple test script to verify server functionality
const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3000';

function testServerConnection() {
    console.log('Testing server connection...');
    
    const ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
        console.log('✅ Connected to server');
        
        // Test creating a room
        const createRoomMessage = {
            type: 'create_room',
            playerName: 'TestPlayer'
        };
        
        console.log('Sending create_room message:', createRoomMessage);
        ws.send(JSON.stringify(createRoomMessage));
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        console.log('📨 Received message:', message);
        
        if (message.type === 'room_created') {
            console.log('✅ Room created successfully');
            console.log('Room ID:', message.roomId);
            console.log('Player ID:', message.playerId);
            
            // Test joining the room
            const joinRoomMessage = {
                type: 'join_room',
                roomId: message.roomId,
                playerName: 'TestPlayer2'
            };
            
            console.log('Sending join_room message:', joinRoomMessage);
            ws.send(JSON.stringify(joinRoomMessage));
        } else if (message.type === 'joined_room') {
            console.log('✅ Joined room successfully');
            
            // Test selecting a token
            const selectTokenMessage = {
                type: 'select_token',
                tokenName: 'football'
            };
            
            console.log('Sending select_token message:', selectTokenMessage);
            ws.send(JSON.stringify(selectTokenMessage));
        } else if (message.type === 'token_selected') {
            console.log('✅ Token selected successfully');
            
            // Test setting ready
            const setReadyMessage = {
                type: 'set_ready',
                ready: true
            };
            
            console.log('Sending set_ready message:', setReadyMessage);
            ws.send(JSON.stringify(setReadyMessage));
        } else if (message.type === 'player_ready_changed') {
            console.log('✅ Player ready status updated');
            
            // Test starting the game
            const startGameMessage = {
                type: 'start_game'
            };
            
            console.log('Sending start_game message:', startGameMessage);
            ws.send(JSON.stringify(startGameMessage));
        } else if (message.type === 'game_started') {
            console.log('✅ Game started successfully');
            
            // Test rejoining the game
            const rejoinMessage = {
                type: 'rejoin_game',
                roomId: message.roomInfo.roomId,
                playerId: message.roomInfo.players[0].id
            };
            
            console.log('Sending rejoin_game message:', rejoinMessage);
            ws.send(JSON.stringify(rejoinMessage));
        } else if (message.type === 'game_state_update') {
            console.log('✅ Game state update received');
            console.log('Players:', message.players);
            console.log('Game state:', message.gameState);
            
            // Close connection after successful test
            setTimeout(() => {
                console.log('✅ All tests passed! Closing connection...');
                ws.close();
            }, 1000);
        } else if (message.type === 'error') {
            console.error('❌ Server error:', message.message);
            ws.close();
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Connection closed');
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
}

// Run the test
testServerConnection(); 