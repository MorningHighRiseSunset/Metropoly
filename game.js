// Multiplayer Game Integration
const DEBUG = false;

// Server configuration
const SERVER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://metropoly-backend.onrender.com';

// Multiplayer state
let socket = null;
let currentPlayerId = null;
let currentPlayerName = '';
let currentRoomId = '';
let gameState = null;
let isMyTurn = false;
let isGameStarted = false;
let multiplayerMode = false;

// Import existing game modules
import * as THREE from './libs/three.module.js';
import {
    GLTFLoader
} from './libs/GLTFLoader.js';
import {
    OrbitControls
} from './libs/OrbitControls.js';
import {
    TextGeometry
} from './libs/TextGeometry.js';
import {
    FontLoader
} from './libs/FontLoader.js';
import {
    CatmullRomCurve3
} from './libs/three.module.js';

// Initialize the GLTFLoader
const loader = new GLTFLoader();

// Game variables (from original script.js)
let camera, scene, renderer, controls;
const clock = new THREE.Clock();

let currentPlayerIndex = 0;
let players = [
    { name: "Player 1", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 2", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 3", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 4", money: 5000, properties: [], selectedToken: null, currentPosition: 0 }
];

let selectedToken = null;
let tokenSelectionUI = null;
let popupGroup;
let raycaster, mouse;

let aiPlayers = new Set();
let aiPlayerIndices = [];
let initialSelectionComplete = false;
let humanPlayerCount = 0;

let allowedToRoll = true;
let isTurnInProgress = false;
let isTokenMoving = false;
let isAIProcessing = false;
let hasTakenAction = false;
let hasDrawnCard = false;
let hasRolledDice = false;
let hasMovedToken = false;
let hasHandledProperty = false;
let turnCounter = 0;
let lastPlayerIndex = -1;

let cameraFollowMode = true;
let userIsMovingCamera = false;

let idleModel, walkModel;
let idleMixer, walkMixer;
let currentAnimation = null;
let rollsRoyceIdleAnim = null;
let helicopterHoverAnim = null;
let currentlyMovingToken = null;
let hatIdleAnim = null;
let nikeIdleAnim = null;
let footballIdleAnim = null;
let burgerIdleAnim = null;

let followCamera;
let idleCameraAngle = 0, idleCameraRadius = 38, idleCameraHeight = 18;
let idleCameraTarget = new THREE.Vector3(0, 0, 0);
let lastCameraMode = null;

let propertyOptionsUI = null;
let gameStarted = false;
let diceContainer = null;

let editMode = false;
let draggedObject = null;
let isPopupVisible = false;

// Video Chat System (from original)
let videoChat = null;
let localStream = null;
let peerConnection = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let isMinimized = false;
let videoChatActive = false;
let videoBoxes = [];
let currentPlayerCount = 0;

let videoChatToggleBtn = null;
let videoChatContainer = null;
let videoGrid = null;

// Multiplayer initialization
function initializeMultiplayer() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('roomId');
    currentPlayerName = urlParams.get('playerName');

    if (!currentRoomId || !currentPlayerName) {
        console.error('Missing room ID or player name');
        window.location.href = 'lobby.html';
        return;
    }

    multiplayerMode = true;
    initializeSocket();
}

function initializeSocket() {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log('Connected to game server');
        currentPlayerId = socket.id;
        showNotification('Connected to game server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from game server');
        showNotification('Disconnected from game server', 'error');
    });

    socket.on('game-started', (data) => {
        console.log('Game started:', data);
        gameState = data.gameState;
        isGameStarted = true;
        
        // Update local players array with server data
        updatePlayersFromServer(data.gameState.players);
        
        // Initialize the game with multiplayer data
        initializeMultiplayerGame();
        
        showNotification('Game started!');
    });

    socket.on('dice-rolled', (data) => {
        console.log('Dice rolled:', data);
        handleRemoteDiceRoll(data);
    });

    socket.on('turn-ended', (data) => {
        console.log('Turn ended:', data);
        handleTurnChange(data);
    });

    socket.on('property-purchased', (data) => {
        console.log('Property purchased:', data);
        handleRemotePropertyPurchase(data);
    });

    socket.on('player-disconnected', (data) => {
        console.log('Player disconnected:', data);
        handlePlayerDisconnection(data.playerId);
    });

    socket.on('player-reconnected', (data) => {
        console.log('Player reconnected:', data);
        handlePlayerReconnection(data);
    });

    socket.on('game-ended', (data) => {
        console.log('Game ended:', data);
        handleGameEnd(data);
    });

    socket.on('turn-timeout', (data) => {
        console.log('Turn timeout:', data);
        handleTurnTimeout(data);
    });

    socket.on('error', (error) => {
        console.error('Server error:', error);
        showNotification(error.message, 'error');
    });
}

function updatePlayersFromServer(serverPlayers) {
    // Clear existing players
    players = [];
    
    // Add players from server
    serverPlayers.forEach(serverPlayer => {
        const player = {
            name: serverPlayer.name,
            money: serverPlayer.money,
            properties: serverPlayer.properties || [],
            selectedToken: serverPlayer.token,
            currentPosition: serverPlayer.currentPosition,
            id: serverPlayer.id,
            isConnected: serverPlayer.isConnected,
            inJail: serverPlayer.inJail || false,
            jailTurns: serverPlayer.jailTurns || 0,
            getOutOfJailCards: serverPlayer.getOutOfJailCards || 0
        };
        
        players.push(player);
        
        // Check if this is the current player
        if (serverPlayer.id === currentPlayerId) {
            currentPlayerIndex = players.length - 1;
        }
    });
}

function initializeMultiplayerGame() {
    // Initialize the game with multiplayer data
    gameStarted = true;
    
    // Create tokens based on server data
    createMultiplayerTokens();
    
    // Update UI
    updateMoneyDisplay();
    updateBoards();
    
    // Check if it's our turn
    checkIfMyTurn();
}

function createMultiplayerTokens() {
    // Clear existing tokens
    scene.children = scene.children.filter(child => 
        !child.userData || !child.userData.isToken
    );
    
    // Create tokens for each player
    players.forEach((player, index) => {
        if (player.selectedToken) {
            createTokenForPlayer(player, index);
        }
    });
}

function createTokenForPlayer(player, index) {
    // Create token based on player's selected token
    const tokenName = player.selectedToken;
    const position = getBoardSquarePosition(player.currentPosition);
    
    // Create token mesh (simplified version)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ 
        color: getPlayerColor(index),
        transparent: true,
        opacity: 0.8
    });
    
    const token = new THREE.Mesh(geometry, material);
    token.position.copy(position);
    token.userData = {
        isToken: true,
        playerId: player.id,
        playerIndex: index,
        tokenName: tokenName
    };
    
    // Add token label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    context.fillStyle = 'white';
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = 'black';
    context.font = '40px Arial';
    context.textAlign = 'center';
    context.fillText(tokenName, 32, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 2, 0);
    sprite.scale.set(2, 2, 1);
    token.add(sprite);
    
    scene.add(token);
}

function checkIfMyTurn() {
    if (!gameState) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    isMyTurn = currentPlayer && currentPlayer.id === currentPlayerId;
    
    if (isMyTurn) {
        showNotification('Your turn!', 'success');
        enableTurnActions();
    } else {
        disableTurnActions();
    }
}

function enableTurnActions() {
    // Enable dice rolling and other turn actions
    if (diceContainer) {
        diceContainer.style.pointerEvents = 'auto';
        diceContainer.style.opacity = '1';
    }
}

function disableTurnActions() {
    // Disable dice rolling and other turn actions
    if (diceContainer) {
        diceContainer.style.pointerEvents = 'none';
        diceContainer.style.opacity = '0.5';
    }
}

// Modified dice rolling for multiplayer
function rollDice() {
    if (!isMyTurn || !socket) {
        showNotification('Not your turn!', 'error');
        return;
    }
    
    if (isTurnInProgress) {
        showNotification('Turn already in progress!', 'error');
        return;
    }
    
    isTurnInProgress = true;
    
    // Send dice roll to server
    socket.emit('roll-dice', {});
    
    // Show rolling animation
    showDiceRollingAnimation();
}

function handleRemoteDiceRoll(data) {
    // Update player position
    const player = players.find(p => p.id === data.playerId);
    if (player) {
        const oldPosition = player.currentPosition;
        player.currentPosition = data.newPosition;
        
        // Move token
        moveTokenToPosition(player, oldPosition, data.newPosition);
        
        // Show dice result
        showDiceResult(data.total, data.die1, data.die2);
        
        // Handle property landing
        handlePropertyLanding(player, data.newPosition);
    }
    
    // Update game state
    if (data.gameState) {
        gameState = data.gameState;
    }
}

function moveTokenToPosition(player, oldPosition, newPosition) {
    // Find token in scene
    const token = scene.children.find(child => 
        child.userData && child.userData.isToken && 
        child.userData.playerId === player.id
    );
    
    if (token) {
        const startPos = getBoardSquarePosition(oldPosition);
        const endPos = getBoardSquarePosition(newPosition);
        
        // Animate token movement
        moveToken(startPos, endPos, token, () => {
            console.log(`Token moved to position ${newPosition}`);
        });
    }
}

function handleTurnChange(data) {
    // Update game state
    if (data.gameState) {
        gameState = data.gameState;
        updatePlayersFromServer(data.gameState.players);
    }
    
    // Check if it's our turn
    checkIfMyTurn();
    
    // Show notification
    if (data.nextPlayer) {
        const nextPlayer = players.find(p => p.id === data.nextPlayer);
        if (nextPlayer) {
            showNotification(`${nextPlayer.name}'s turn`, 'info');
        }
    }
}

function handleRemotePropertyPurchase(data) {
    // Update player money and properties
    const player = players.find(p => p.id === data.playerId);
    if (player) {
        // Update money (this would come from server)
        // Update properties list
        if (!player.properties.includes(data.propertyId)) {
            player.properties.push(data.propertyId);
        }
        
        // Update UI
        updateMoneyDisplay();
        updateBoards();
    }
}

function handlePlayerDisconnection(playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        player.isConnected = false;
        showNotification(`${player.name} disconnected`, 'warning');
    }
}

function handlePlayerReconnection(data) {
    const player = players.find(p => p.id === data.oldPlayerId);
    if (player) {
        player.id = data.newPlayerId;
        player.isConnected = true;
        showNotification(`${player.name} reconnected`, 'success');
    }
}

function handleGameEnd(data) {
    showNotification(`Game ended: ${data.reason}`, 'info');
    
    // Show game over screen
    setTimeout(() => {
        if (confirm('Game ended. Return to lobby?')) {
            window.location.href = 'lobby.html';
        }
    }, 3000);
}

function handleTurnTimeout(data) {
    const player = players.find(p => p.id === data.playerId);
    if (player) {
        showNotification(`${player.name} timed out`, 'warning');
    }
}

// Modified property purchase for multiplayer
function buyProperty(player, property, callback) {
    if (!socket || !isMyTurn) {
        showNotification('Not your turn!', 'error');
        return;
    }
    
    // Send purchase request to server
    socket.emit('buy-property', {
        propertyId: property.id
    });
    
    if (callback) callback();
}

// Modified end turn for multiplayer
function endTurn() {
    if (!socket || !isMyTurn) {
        showNotification('Not your turn!', 'error');
        return;
    }
    
    // Send end turn to server
    socket.emit('end-turn', {});
    
    // Reset turn state
    isTurnInProgress = false;
    hasTakenAction = false;
    hasDrawnCard = false;
    hasRolledDice = false;
    hasMovedToken = false;
    hasHandledProperty = false;
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#333';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize multiplayer when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in multiplayer mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('roomId')) {
        initializeMultiplayer();
    } else {
        // Single player mode - use original initialization
        init();
    }
});

// Export functions for use in other modules
export {
    initializeMultiplayer,
    rollDice,
    buyProperty,
    endTurn,
    showNotification
}; 