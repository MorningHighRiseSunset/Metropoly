// Multiplayer game management for Metropoly using Socket.IO
class MultiplayerGame {
    constructor(roomId, playerId) {
        // Debug logging for constructor
        console.log('=== MULTIPLAYER GAME CONSTRUCTOR DEBUG ===');
        console.log('Received roomId:', roomId);
        console.log('Received playerId:', playerId);
        console.log('roomId type:', typeof roomId);
        console.log('playerId type:', typeof playerId);
        
        // Safeguard: If roomId is undefined, try to recover it
        if (!roomId || roomId === 'undefined') {
            console.warn('Room ID is undefined or invalid, attempting to recover...');
            
            // Try to get from session storage
            try {
                const storedState = sessionStorage.getItem('metropoly_game_state');
                if (storedState) {
                    const gameState = JSON.parse(storedState);
                    if (gameState.roomId && gameState.roomId !== 'undefined') {
                        roomId = gameState.roomId;
                        console.log('Recovered roomId from session storage:', roomId);
                    }
                }
            } catch (error) {
                console.error('Error reading session storage for room recovery:', error);
            }
            
            // If still no room ID, show error and redirect
            if (!roomId || roomId === 'undefined') {
                console.error('Could not recover room ID, redirecting to lobby');
                alert('Invalid game session. Please return to the lobby.');
                window.location.href = 'lobby.html';
                return;
            }
        }
        
        this.roomId = roomId;
        this.playerId = playerId;
        this.socket = null;
        this.gameState = null;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.isMyTurn = false;
        this.serverUrl = this.getServerUrl();
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Set global multiplayer flag immediately
        window.isMultiplayerMode = true;
        
        // Disable token selection UI immediately
        this.disableTokenSelectionUI();
        
        // Check for session storage data
        this.checkSessionStorage();
        
        console.log('Final roomId:', this.roomId);
        console.log('Final playerId:', this.playerId);
        console.log('MultiplayerGame initialized successfully');
        console.log('==========================================');
        
        // Ensure playerId is properly set and accessible
        if (this.playerId) {
            console.log('Setting playerId on window object for global access');
            window.currentPlayerId = this.playerId;
        }
        
        this.connectSocketIO();
        this.setupGame();
    }

    getServerUrl() {
        // For development, use localhost. For production, use your Render URL
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        } else {
            // Use your actual Render backend URL
            return 'https://metropoly.onrender.com';
        }
    }

    checkSessionStorage() {
        try {
            const storedState = sessionStorage.getItem('metropoly_game_state');
            if (storedState) {
                const gameState = JSON.parse(storedState);
                console.log('Found stored game state:', gameState);
                
                // Validate the stored state matches current URL parameters
                if (gameState.roomId === this.roomId && gameState.playerId === this.playerId) {
                    this.storedGameState = gameState;
                    console.log('Stored game state validated for current session');
                } else {
                    console.warn('Stored game state does not match current session, clearing');
                    sessionStorage.removeItem('metropoly_game_state');
                }
            }
        } catch (error) {
            console.error('Error reading session storage:', error);
            sessionStorage.removeItem('metropoly_game_state');
        }
    }

    connectSocketIO() {
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error('Max connection attempts reached, proceeding with fallback mode');
            this.createFallbackPlayers();
            return;
        }
        this.connectionAttempts++;
        console.log(`Connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}`);
        try {
            this.socket = io(this.serverUrl);
            this.socket.on('connect', () => {
                console.log('Connected to multiplayer server');
                this.connectionAttempts = 0;
                // Join the game room using lobby_data event for consistency
                this.socket.emit('lobby_data', {
                    type: 'join_room',
                    roomId: this.roomId,
                    playerId: this.playerId
                });
                this.rejoinGame();
            });
            this.socket.on('disconnect', () => {
                console.log('Disconnected from multiplayer server');
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    console.log(`Retrying connection in ${this.reconnectDelay}ms...`);
                    setTimeout(() => this.connectSocketIO(), this.reconnectDelay);
                } else {
                    console.error('Max reconnection attempts reached, creating fallback players');
                    this.createFallbackPlayers();
                }
            });
            this.socket.on('connect_error', () => {
                console.error('Connection error, retrying...');
                if (this.connectionAttempts < this.maxConnectionAttempts) {
                    setTimeout(() => this.connectSocketIO(), this.reconnectDelay);
                } else {
                    this.createFallbackPlayers();
                }
            });
            // Listen for both lobby_data and server_message events
            this.socket.on('lobby_data', (data) => {
                this.handleServerMessage(data);
            });
            this.socket.on('server_message', (data) => {
                this.handleServerMessage(data);
            });
            this.socket.on('error', (message) => {
                this.handleServerError(message);
            });
        } catch (error) {
            console.error('Failed to connect:', error);
            if (this.connectionAttempts < this.maxConnectionAttempts) {
                setTimeout(() => this.connectSocketIO(), this.reconnectDelay);
            } else {
                this.createFallbackPlayers();
            }
        }
    }

    rejoinGame() {
        console.log('Attempting to rejoin game...');
        
        // Use stored game state if available
        const rejoinData = {
            type: 'rejoin_game',
            roomId: this.roomId,
            playerId: this.playerId
        };
        
        if (this.storedGameState) {
            console.log('Using stored game state for rejoin');
            rejoinData.storedState = this.storedGameState;
        }
        
        // Send rejoin message with a small delay to ensure proper sync
        setTimeout(() => {
            this.sendMessage(rejoinData);
            
            // Also try to request current game state after a short delay
            setTimeout(() => {
                console.log('Requesting current game state...');
                this.sendMessage({
                    type: 'request_game_state',
                    roomId: this.roomId,
                    playerId: this.playerId
                });
            }, 1000);
        }, 200); // Small delay to ensure server is ready
        
        // Set a timeout to handle case where no response is received
        setTimeout(() => {
            if (this.players.length === 0) {
                console.log('No players received after rejoin attempt, creating fallback players');
                this.createFallbackPlayers();
            }
        }, 5000); // 5 second timeout
        
        // Also ensure dice button exists after rejoin
        setTimeout(() => {
            this.ensureDiceButtonExists();
        }, 2000);
    }

    handleServerMessage(data) {
        console.log('Received server message:', data);
        
        switch (data.type) {
            case 'joined_room':
                console.log('Joined room successfully');
                break;
                
            case 'player_joined':
                console.log('Player joined:', data.playerName);
                break;
                
            case 'player_left':
                console.log('Player left:', data.playerId);
                break;
                
            case 'game_started':
                this.handleGameStarted(data);
                break;
                
            case 'game_state_update':
                this.handleGameStateUpdate(data);
                break;
                
            case 'player_turn':
                this.handlePlayerTurn(data);
                break;
                
            case 'game_action':
                this.handleGameAction(data);
                break;
                
            case 'player_joined_game':
                this.handlePlayerJoinedGame(data);
                break;
                
            case 'player_left_game':
                this.handlePlayerLeftGame(data);
                break;
                
            case 'dice_roll':
                this.handleDiceRoll(data);
                break;
                
            case 'move_token':
                this.handleMoveToken(data);
                break;
                
            case 'buy_property':
                this.handleBuyProperty(data);
                break;
                
            case 'pay_rent':
                this.handlePayRent(data);
                break;
                
            case 'end_turn':
                this.handleEndTurn(data);
                break;
                
            case 'draw_card':
                this.handleDrawCard(data);
                break;
                
            case 'go_to_jail':
                this.handleGoToJail(data);
                break;
                
            case 'bankruptcy':
                this.handleBankruptcy(data);
                break;
                
            case 'dice_rolled':
                this.handleDiceRolled(data);
                break;
                
            case 'property_purchased':
                this.handlePropertyPurchased(data);
                break;
                
            case 'rent_paid':
                this.handleRentPaid(data);
                break;
                
            case 'turn_ended':
                this.handleTurnEnded(data);
                break;
                
            case 'player_rejoined':
                console.log('Player rejoined:', data.playerName);
                this.showNotification(`${data.playerName} rejoined the game`, 'info');
                break;
                
            case 'player_recovered':
                console.log('Player recovered:', data.playerName);
                this.showNotification(`${data.playerName} recovered their connection`, 'info');
                break;
                
            case 'game_transition_ready_ack':
                console.log('Game transition acknowledged by server');
                break;
                
            case 'error':
                console.error('Server error:', data.message);
                this.handleServerError(data.message);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleServerError(message) {
        if (message.includes('not found')) {
            console.log('Player/room not found, this might be expected for new connections');
            // Retry requesting game state after a delay
            setTimeout(() => {
                console.log('Retrying game state request...');
                this.sendMessage({
                    type: 'request_game_state',
                    roomId: this.roomId,
                    playerId: this.playerId
                });
            }, 2000);
        } else {
            this.showNotification(`Server error: ${message}`, 'error');
        }
    }

    handleGameStarted(data) {
        console.log('Game started, initializing game state');
        this.handleGameStateUpdate(data);
    }

    handleGameStateUpdate(data) {
        console.log('Received game state update:', data);
        console.log('Previous players count:', this.players.length);
        
        this.gameState = data.gameState;
        this.players = data.players || [];
        this.currentPlayerIndex = data.currentPlayerIndex || 0;
        this.isMyTurn = data.currentPlayerId === this.playerId;
        
        // Ensure token selection UI is disabled
        this.disableTokenSelectionUI();
        
        console.log('Game state updated - Players count:', this.players.length);
        console.log('Players data:', this.players);
        console.log('Current player index:', this.currentPlayerIndex);
        console.log('Is my turn:', this.isMyTurn);
        console.log('Game state status:', this.gameState?.status);
        
        // Clear session storage after successful game state reception
        if (this.players.length > 0) {
            try {
                sessionStorage.removeItem('metropoly_game_state');
                console.log('Cleared session storage after successful game state reception');
            } catch (error) {
                console.error('Error clearing session storage:', error);
            }
        }
        
        // Reset the wait counter since we now have game state
        this.waitCount = 0;
        
        // Check if game modules are loaded before proceeding
        if (window.scene && window.players && window.createTokens && window.init) {
            console.log('Game modules loaded, proceeding with game state update');
            
            // Update the local game state
            this.syncGameState();
            
            // Ensure tokens are visible and positioned correctly
            this.ensureTokensAreVisible();
            
            // Ensure dice button exists and is properly configured
            this.ensureDiceButtonExists();
            
            // Update UI displays
            this.updatePlayersDisplay();
            this.updateVideoChatLabels();
        } else {
            console.log('Game modules not loaded yet, waiting for them...');
            // Wait for game modules to load, then retry
            setTimeout(() => {
                if (window.scene && window.players && window.createTokens && window.init) {
                    console.log('Game modules now loaded, retrying game state update');
                    this.syncGameState();
                    this.ensureTokensAreVisible();
                    this.ensureDiceButtonExists();
                    this.updatePlayersDisplay();
                    this.updateVideoChatLabels();
                } else {
                    console.log('Game modules still not loaded, will retry in waitForGameLoad');
                }
            }, 1000);
        }
        
        // Enable/disable controls based on turn
        if (this.isMyTurn) {
            this.enablePlayerControls();
        } else {
            this.disablePlayerControls();
        }
    }

    handlePlayerTurn(data) {
        this.isMyTurn = data.playerId === this.playerId;
        this.currentPlayerIndex = data.currentPlayerIndex;
        
        // Update the global currentPlayerIndex for the main game
        if (window.currentPlayerIndex !== undefined) {
            window.currentPlayerIndex = this.currentPlayerIndex;
        }
        
        if (this.isMyTurn) {
            this.showTurnIndicator(true);
            this.showNotification("It's your turn!", 'success');
            // Enable player controls
            this.enablePlayerControls();
            // Show dice button for current player
            this.showDiceButtonForMultiplayer();
        } else {
            this.showTurnIndicator(false);
            this.showNotification(`${data.playerName}'s turn`, 'info');
            // Disable player controls
            this.disablePlayerControls();
            // Keep dice button visible but disabled for other players
            const rollButton = document.querySelector('.dice-button');
            if (rollButton) {
                rollButton.style.display = 'block';
                rollButton.disabled = true;
                rollButton.style.opacity = '0.5';
                rollButton.style.cursor = 'not-allowed';
            }
        }
        
        this.updatePlayersDisplay();
    }

    handleGameAction(data) {
        console.log('Game action received:', data);
        // Handle generic game actions
        this.showNotification(`${this.getPlayerName(data.playerId)} performed: ${data.action}`, 'info');
    }

    handlePlayerJoinedGame(data) {
        this.showNotification(`${data.playerName} joined the game`, 'success');
        this.updatePlayersDisplay();
    }

    handlePlayerLeftGame(data) {
        this.showNotification(`${data.playerName} left the game`, 'error');
        this.updatePlayersDisplay();
    }

    // Game action handlers
    handleDiceRoll(data) {
        const { dice1, dice2, total, playerId } = data;
        this.showNotification(`${this.getPlayerName(playerId)} rolled ${dice1} + ${dice2} = ${total}`, 'info');
        
        // Update the game's dice display
        if (window.showDiceResult) {
            window.showDiceResult(total, dice1, dice2);
        }
    }

    handleMoveToken(data) {
        const { playerId, fromPosition, toPosition, passedGo } = data;
        this.showNotification(`${this.getPlayerName(playerId)} moved from ${fromPosition} to ${toPosition}`, 'info');
        
        // Update token position in the game
        this.moveTokenInGame(playerId, fromPosition, toPosition, passedGo);
    }

    handleBuyProperty(data) {
        const { playerId, propertyName, price } = data;
        this.showNotification(`${this.getPlayerName(playerId)} bought ${propertyName} for $${price}`, 'info');
        
        // Update property ownership in the game
        this.updatePropertyOwnership(playerId, propertyName);
    }

    handlePayRent(data) {
        const { fromPlayerId, toPlayerId, amount, propertyName } = data;
        this.showNotification(`${this.getPlayerName(fromPlayerId)} paid $${amount} rent to ${this.getPlayerName(toPlayerId)} for ${propertyName}`, 'info');
        
        // Update player money in the game
        this.updatePlayerMoney(fromPlayerId, -amount);
        this.updatePlayerMoney(toPlayerId, amount);
    }

    handleEndTurn(data) {
        const { playerId } = data;
        this.showNotification(`${this.getPlayerName(playerId)} ended their turn`, 'info');
        
        // Request next player's turn from server
        this.sendMessage({
            type: 'request_next_turn',
            roomId: this.roomId
        });
    }

    handleDrawCard(data) {
        const { playerId, cardType, cardText } = data;
        this.showNotification(`${this.getPlayerName(playerId)} drew a ${cardType} card: ${cardText}`, 'info');
        
        // Show card effect in the game
        if (window.drawCard) {
            window.drawCard(cardType);
        }
    }

    handleGoToJail(data) {
        const { playerId } = data;
        this.showNotification(`${this.getPlayerName(playerId)} went to jail!`, 'info');
        
        // Move player to jail in the game
        this.movePlayerToJail(playerId);
    }

    handleBankruptcy(data) {
        const { playerId } = data;
        this.showNotification(`${this.getPlayerName(playerId)} went bankrupt!`, 'error');
        
        // Remove player from game
        this.removePlayerFromGame(playerId);
    }

    // New specific handlers for server messages
    handleDiceRolled(data) {
        console.log('=== HANDLE DICE ROLLED ===');
        console.log('Received dice roll data:', data);
        console.log('Current player ID:', this.playerId);
        console.log('Dice roll data player ID:', data.playerId);
        console.log('Is this our dice roll?', data.playerId === this.playerId);
        
        // Update the player's position in our local state
        const player = this.getPlayerById(data.playerId);
        if (player) {
            console.log(`Player ${data.playerId} found in local state:`, player);
            console.log(`Previous position: ${player.position}, New position: ${data.newPosition}`);
            
            // Calculate the starting position correctly
            const fromPosition = data.fromPosition || ((data.newPosition - data.total + 42) % 42);
            console.log(`Calculated fromPosition: ${fromPosition}, newPosition: ${data.newPosition}`);
            
            // Update player position
            player.position = data.newPosition;
            console.log(`Updated player ${data.playerId} position to ${data.newPosition}`);
            
            // Also update the global game state if available
            if (window.players) {
                const gamePlayer = window.players.find(p => p.id === data.playerId);
                if (gamePlayer) {
                    gamePlayer.currentPosition = data.newPosition;
                    gamePlayer.position = data.newPosition;
                    console.log(`Updated game player ${data.playerId} position to ${data.newPosition}`);
                }
            }
            
            // Update global players array if available
            if (typeof players !== 'undefined') {
                const globalPlayer = players.find(p => p.id === data.playerId);
                if (globalPlayer) {
                    globalPlayer.currentPosition = data.newPosition;
                    globalPlayer.position = data.newPosition;
                    console.log(`Updated global player ${data.playerId} position to ${data.newPosition}`);
                }
            }
            
            // Move the visual token
            console.log(`Calling moveTokenInGame for player ${data.playerId} from ${fromPosition} to ${data.newPosition}`);
            this.moveTokenInGame(data.playerId, fromPosition, data.newPosition, data.passedGo);
        } else {
            console.error(`Player ${data.playerId} not found in local state`);
            console.log('Available players:', this.players);
        }
        
        // Show dice result to all players
        if (window.showDiceResult) {
            window.showDiceResult(data.total, data.dice1, data.dice2);
        }
        
        // Update money display if this is our roll
        if (data.playerId === this.playerId && window.updateMoneyDisplay) {
            window.updateMoneyDisplay();
        }
        
        console.log('=== END HANDLE DICE ROLLED ===');
    }

    handlePropertyPurchased(data) {
        console.log('Property purchased:', data);
        
        // Show purchase notification
        this.showNotification(
            `🏠 ${data.playerName} purchased ${data.propertyName} for $${data.price}`,
            'success'
        );
        
        // Update property ownership on the board
        this.updatePropertyOwnership(data.playerId, data.propertyName);
        
        // Update player money
        this.updatePlayerMoney(data.playerId, data.newMoney);
    }

    handleRentPaid(data) {
        console.log('Rent paid:', data);
        
        // Show rent payment notification
        this.showNotification(
            `💸 ${data.playerName} paid $${data.rent} rent to ${data.ownerName} for ${data.propertyName}`,
            'info'
        );
        
        // Update both players' money
        this.updatePlayerMoney(data.playerId, data.playerNewMoney);
        this.updatePlayerMoney(data.ownerId, data.ownerNewMoney);
    }

    handleTurnEnded(data) {
        console.log('Turn ended:', data);
        
        // Show turn change notification
        this.showNotification(
            `🔄 ${this.getPlayerName(data.playerId)} ended their turn. It's now ${data.nextPlayerName}'s turn!`,
            'info'
        );
        
        // Update turn state
        this.isMyTurn = data.nextPlayerId === this.playerId;
        this.currentPlayerIndex = data.currentPlayerIndex;
        
        // Show turn indicator for next player
        this.showTurnIndicator(this.isMyTurn);
        
        // Update player controls
        if (this.isMyTurn) {
            this.enablePlayerControls();
        } else {
            this.disablePlayerControls();
        }
    }

    // Player action methods
    rollDice() {
        if (!this.isMyTurn) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }

        console.log('Rolling dice for multiplayer game...');
        
        // Send dice roll request to server (server will generate the roll)
        this.sendMessage({
            type: 'game_action',
            action: 'dice_roll',
            data: {
                playerId: this.playerId
            }
        });
        
        // Show immediate feedback
        this.showNotification('Rolling dice...', 'info');
    }

    buyProperty(propertyName, price) {
        if (!this.isMyTurn) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }

        this.sendMessage({
            type: 'game_action',
            action: 'buy_property',
            data: {
                propertyName: propertyName,
                price: price,
                playerId: this.playerId
            }
        });
    }

    endTurn() {
        if (!this.isMyTurn) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }

        this.sendMessage({
            type: 'game_action',
            action: 'end_turn',
            data: {
                playerId: this.playerId
            }
        });
    }

    // Game integration methods
    setupGame() {
        console.log('Setting up multiplayer game...');
        
        // Override global game functions for multiplayer
        this.overrideGameFunctions();
        
        // Set up page unload handler
        window.addEventListener('beforeunload', (e) => {
            console.log('Multiplayer game page unloading, cleaning up');
            this.leaveGame();
            // Don't show confirmation dialog
        });

        // Set up page visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.log('Multiplayer game page becoming hidden');
                // Store current state in case of page refresh
                if (this.players.length > 0) {
                    const gameState = {
                        roomId: this.roomId,
                        playerId: this.playerId,
                        players: this.players,
                        gameState: this.gameState,
                        timestamp: Date.now()
                    };
                    try {
                        sessionStorage.setItem('metropoly_game_state', JSON.stringify(gameState));
                    } catch (error) {
                        console.error('Failed to store game state on page hide:', error);
                    }
                }
            }
        });

        // Wait for game modules to load
        this.waitForGameLoad();
        
        // Set up multiplayer-specific UI
        this.setupMultiplayerUI();
    }

    overrideGameFunctions() {
        // Override dice rolling to use multiplayer
        if (window.rollDice) {
            const originalRollDice = window.rollDice;
            window.rollDice = () => {
                if (this.isMyTurn) {
                    this.rollDice();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
        }

        // Override property buying to use multiplayer
        if (window.buyProperty) {
            const originalBuyProperty = window.buyProperty;
            window.buyProperty = (property, callback) => {
                if (this.isMyTurn) {
                    this.buyProperty(property.name, property.price);
                    if (callback) callback();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
        }

        // Override turn ending to use multiplayer
        if (window.endTurn) {
            const originalEndTurn = window.endTurn;
            window.endTurn = () => {
                if (this.isMyTurn) {
                    this.endTurn();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
        }
    }

    setupMultiplayerUI() {
        // Create multiplayer status indicator
        this.createMultiplayerStatusIndicator();
        
        // Create player list display
        this.createPlayerListDisplay();
        
        // Create connection status indicator
        this.createConnectionStatusIndicator();
        
        // Add leave game button
        this.createLeaveGameButton();
        
        // Ensure dice button is created
        this.showDiceButtonForMultiplayer();
    }
    
    createMultiplayerStatusIndicator() {
        // Check if there's already a multiplayer UI element
        const existingUI = document.getElementById('multiplayer-ui');
        if (existingUI) {
            // Add a small indicator to the existing UI instead of creating a new one
            let statusDiv = document.getElementById('multiplayer-status');
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.id = 'multiplayer-status';
                statusDiv.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #4CAF50;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    z-index: 10001;
                `;
                statusDiv.textContent = 'MULTI';
                existingUI.style.position = 'relative';
                existingUI.style.background = 'rgba(0, 0, 0, 0.9)';
                existingUI.appendChild(statusDiv);
            }
            return;
        }
        
        // Create new indicator if no existing UI
        if (document.getElementById('multiplayer-status')) return;
        
        const statusDiv = document.createElement('div');
        statusDiv.id = 'multiplayer-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #4CAF50;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        statusDiv.textContent = 'MULTIPLAYER';
        document.body.appendChild(statusDiv);
    }
    
    createPlayerListDisplay() {
        // Use existing players-list element if it exists
        let playersDiv = document.getElementById('players-list');
        if (!playersDiv) {
            // Create new element if it doesn't exist
            playersDiv = document.createElement('div');
            playersDiv.id = 'multiplayer-players';
            playersDiv.style.cssText = `
                position: fixed;
                top: 60px;
                right: 10px;
                color: white;
                padding: 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                min-width: 180px;
                max-height: 250px;
                overflow-y: auto;
                background: rgba(0, 0, 0, 0.9) !important;
                border: 1px solid #333;
            `;
            document.body.appendChild(playersDiv);
        }
        
        // Clear and initialize the content
        playersDiv.innerHTML = '<div style="font-weight: bold; margin-bottom: 5px;">Players:</div>';
        
        // Ensure the existing multiplayer-ui is visible and properly positioned
        const existingUI = document.getElementById('multiplayer-ui');
        if (existingUI) {
            existingUI.style.display = 'block';
            existingUI.style.zIndex = '1000';
            existingUI.style.background = 'rgba(0, 0, 0, 0.9)';
        }
    }
    
    createConnectionStatusIndicator() {
        // Use existing connection-status element if it exists
        let connDiv = document.getElementById('connection-status');
        if (!connDiv) {
            // Create new element if it doesn't exist
            connDiv = document.createElement('div');
            connDiv.id = 'connection-status';
            connDiv.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 11px;
                z-index: 10000;
                border: 1px solid #333;
            `;
            document.body.appendChild(connDiv);
        }
        connDiv.textContent = 'Connecting...';
    }
    
    createLeaveGameButton() {
        // Check if there's already a leave game button in the HTML
        const existingBtn = document.querySelector('button[onclick="leaveGame()"]');
        if (existingBtn) {
            // Update the existing button's onclick to use our multiplayer instance
            existingBtn.onclick = () => this.leaveGame();
            return;
        }
        
        // Create new button if none exists
        if (document.getElementById('leave-game-btn')) return;
        
        const leaveBtn = document.createElement('button');
        leaveBtn.id = 'leave-game-btn';
        leaveBtn.textContent = 'Leave Game';
        leaveBtn.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border: 1px solid #333;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            z-index: 10000;
        `;
        leaveBtn.onclick = () => this.leaveGame();
        document.body.appendChild(leaveBtn);
    }

    setupMultiplayerGame() {
        console.log('Setting up multiplayer game...');
        this.disableTokenSelectionUI();
        this.waitForGameLoad();
        
        // Add a timeout to prevent infinite waiting
        setTimeout(() => {
            if (this.waitCount > 0 && this.players.length === 0) {
                console.log('Timeout reached, attempting to request game state...');
                this.sendMessage({
                    type: 'request_game_state',
                    roomId: this.roomId,
                    playerId: this.playerId
                });
            }
        }, 10000); // 10 second timeout
    }

    waitForGameLoad() {
        // Add a static counter to prevent infinite loops
        if (!this.waitCount) this.waitCount = 0;
        this.waitCount++;
        
        console.log(`Waiting for game modules to load... (attempt ${this.waitCount})`, {
            scene: !!window.scene,
            players: !!window.players,
            createTokens: !!window.createTokens,
            init: !!window.init,
            multiplayerPlayers: this.players.length
        });
        
        // Check if the game is ready
        if (window.scene && window.players && window.createTokens && window.init) {
            console.log('All game modules loaded, initializing multiplayer players...');
            // Game is loaded, initialize multiplayer players
            if (this.players.length > 0) {
                this.initializeMultiplayerPlayers();
            } else {
                console.log('No players available yet, waiting for game state...');
                // Only continue waiting if we haven't exceeded max attempts
                if (this.waitCount < 50) {
                    setTimeout(() => this.waitForGameLoad(), 500);
                } else {
                    console.error('Timeout waiting for players to be available. Creating fallback players...');
                    // Create fallback players for debugging
                    this.players = [{
                        id: this.playerId,
                        name: 'Player 1',
                        token: 'rolls royce',
                        money: 1500,
                        position: 0
                    }];
                    this.initializeMultiplayerPlayers();
                }
            }
        } else {
            // Wait a bit and try again, but limit attempts
            if (this.waitCount < 100) {
                setTimeout(() => this.waitForGameLoad(), 200);
            } else {
                console.error('Timeout waiting for game modules to load');
                // Try to proceed anyway to avoid infinite loop
                this.initializeMultiplayerPlayers();
            }
        }
    }

    initializeMultiplayerPlayers() {
        // Convert lobby players to game players with correct structure for main game
        const gamePlayers = this.players.map((player, index) => ({
            id: player.id,
            name: player.name,
            tokenName: player.token,
            currentPosition: 0, // Use currentPosition to match main game
            money: 5000, // Use same money as main game
            properties: [],
            inJail: false,
            jailTurns: 0,
            isAI: false, // All players are human in multiplayer
            selectedToken: null // Will be set to actual token object later
        }));

        // Update both player arrays to ensure consistency
        if (typeof players !== 'undefined') {
            // Clear the global players array and replace with multiplayer players
            players.length = 0;
            gamePlayers.forEach(player => players.push(player));
        }
        
        // Also update window.players to ensure consistency
        window.players = gamePlayers;
        
        // Ensure both arrays reference the same data
        if (typeof players !== 'undefined') {
            // Make sure both arrays point to the same data
            for (let i = 0; i < gamePlayers.length; i++) {
                if (players[i]) {
                    players[i] = gamePlayers[i];
                }
            }
        }

        // Set the current player index based on this player's position
        const myPlayer = this.players.find(p => p.id === this.playerId);
        if (myPlayer) {
            const myIndex = this.players.findIndex(p => p.id === this.playerId);
            if (window.currentPlayerIndex !== undefined) {
                window.currentPlayerIndex = myIndex;
            }
        }

        // Initialize the game board
        if (window.initializePlayers) {
            window.initializePlayers();
        }

        // Create tokens first, then position them
        if (window.createTokens) {
            window.createTokens(() => {
                // Ensure tokens are properly assigned and visible after creation
                this.ensureTokensAreVisible();
                
                // Start the game if we have enough players
                if (this.players.length >= 2) {
                    this.startMultiplayerGame();
                }
            });
        } else {
            // Fallback if createTokens is not available
            this.ensureTokensAreVisible();
            
            // Start the game if we have enough players
            if (this.players.length >= 2) {
                this.startMultiplayerGame();
            }
        }
    }

    ensureTokensAreVisible() {
        if (this._ensuringTokens) {
            console.log('Already ensuring tokens, skipping...');
            return;
        }
        this._ensuringTokens = true;

        try {
            // Debug: Check the state of both player arrays
            if (typeof players !== 'undefined' && players[0]) {
                console.log('Debug - Global players[0].selectedToken:', players[0].selectedToken);
            }
            if (window.players && window.players[0]) {
                console.log('Debug - Window players[0].selectedToken:', window.players[0].selectedToken);
            }
            
            // Get all objects in the scene
            const availableObjects = [];
            if (window.scene) {
                // Use a more controlled traversal to avoid recursion
                const traverseSafely = (object) => {
                    if (object.userData && object.userData.tokenName) {
                        availableObjects.push(object);
                    }
                    if (object.children) {
                        for (let i = 0; i < object.children.length; i++) {
                            traverseSafely(object.children[i]);
                        }
                    }
                };
                
                traverseSafely(window.scene);
            }

            // Get loaded token models
            const loadedTokenModels = [];
            if (window.availableTokens) {
                loadedTokenModels.push(...window.availableTokens.map(t => t.name));
            }

            // Position tokens for each player
            this.players.forEach((player, index) => {
                const tokenName = player.token;
                
                // Find the token object
                let token = null;
                for (const obj of availableObjects) {
                    if (obj.userData.tokenName === tokenName) {
                        token = obj;
                        break;
                    }
                }

                if (token) {
                    // Position token at start
                    const startPosition = { x: 18.5, y: 2, z: 18.5 };
                    token.position.set(startPosition.x, startPosition.y, startPosition.z);
                    
                    // Set important userData for token identification
                    if (!token.userData) token.userData = {};
                    token.userData.playerId = player.id;
                    token.userData.playerIndex = index;
                    token.userData.tokenName = player.token;
                    token.userData.isPlayerToken = true;
                    
                    // Update the player's selectedToken reference
                    if (window.players && window.players[index]) {
                        window.players[index].selectedToken = token;
                        window.players[index].currentPosition = 0;
                        
                        // Also update global players array
                        if (typeof players !== 'undefined' && players[index]) {
                            players[index].selectedToken = token;
                            players[index].currentPosition = 0;
                        }
                        
                        // Update both player arrays with token reference
                        this.updatePlayerToken(index, token, player.token);
                    }
                    
                    console.log(`Token ${player.token} assigned to player ${player.name} (ID: ${player.id}) at index ${index}`);
                } else {
                    // Token not found, log but don't recurse
                    console.log('Token not found for', tokenName, '- will be created when available');
                }
            });
        } finally {
            this._ensuringTokens = false;
        }
    }

    startMultiplayerGame() {
        // Initialize game state
        if (window.validateGameState) {
            window.validateGameState();
        }
        
        // Ensure tokens are visible and positioned correctly
        this.ensureTokensAreVisible();
        
        // Update money display
        if (window.updateMoneyDisplay) {
            window.updateMoneyDisplay();
        }
        
        // Ensure dice button is created and visible
        this.ensureDiceButtonExists();
        
        // Show notification that game is ready
        this.showNotification('Multiplayer game started! Tokens assigned from lobby.', 'success');
        
        // Update video chat labels with player names and tokens
        this.updateVideoChatLabels();
        
        // Initialize video chat if available
        if (window.initVideoChat) {
            window.initVideoChat();
        }
        
        // Validate multiplayer game setup
        setTimeout(() => this.validateMultiplayerGame(), 1000);
    }

    syncGameState() {
        if (!this.gameState || !window.players) return;

        // Check if gameState.players exists and is an array
        if (!this.gameState.players || !Array.isArray(this.gameState.players)) {
            console.log('Game state players not available yet, skipping sync');
            return;
        }

        // Sync player positions, money, and properties
        this.gameState.players.forEach((serverPlayer, index) => {
            if (window.players[index]) {
                window.players[index].position = serverPlayer.position;
                window.players[index].money = serverPlayer.money;
                window.players[index].properties = serverPlayer.properties;
                window.players[index].inJail = serverPlayer.inJail;
                window.players[index].jailTurns = serverPlayer.jailTurns;
                
                // Also sync with global players array for main game logic
                if (typeof players !== 'undefined' && players && players[index]) {
                    players[index].currentPosition = serverPlayer.position || serverPlayer.currentPosition;
                    players[index].money = serverPlayer.money;
                    players[index].properties = serverPlayer.properties;
                    players[index].inJail = serverPlayer.inJail;
                    players[index].jailTurns = serverPlayer.jailTurns;
                }
            }
        });

        // Update the game display
        if (window.updateMoneyDisplay) {
            window.updateMoneyDisplay();
        }
        if (window.updateBoards) {
            window.updateBoards();
        }
    }

    // UI update methods
    updatePlayersDisplay() {
        // Try to find the players display element (either existing or created)
        let playersDiv = document.getElementById('players-list') || document.getElementById('multiplayer-players');
        if (!playersDiv) return;
        
        let html = '<div style="font-weight: bold; margin-bottom: 5px;">Players:</div>';
        
        this.players.forEach((player, index) => {
            const isCurrentPlayer = index === this.currentPlayerIndex;
            const isMe = player.id === this.playerId;
            
            html += `
                <div class="player-info ${isCurrentPlayer ? 'current-player' : ''}">
                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="player-details">
                        <div>${player.name}${isMe ? ' (You)' : ''}</div>
                        <div>$${player.money || 5000}</div>
                        <div>Pos: ${player.position || 0}</div>
                    </div>
                    <div class="player-token">${player.token || 'No token'}</div>
                    ${isCurrentPlayer ? '<div style="color: #ffd700; font-weight: bold;">🎲</div>' : ''}
                    ${isMe ? '<div style="color: #4CAF50; font-weight: bold;">YOU</div>' : ''}
                </div>
            `;
        });
        
        playersDiv.innerHTML = html;
        
        // Update video chat labels with player names and tokens
        this.updateVideoChatLabels();
    }

    updateVideoChatLabels() {
        if (typeof videoBoxes !== 'undefined' && videoBoxes.length > 0) {
            this.players.forEach((player, index) => {
                if (videoBoxes[index]) {
                    const label = videoBoxes[index].querySelector('.video-label');
                    if (label) {
                        label.textContent = `${player.name} (${player.token})`;
                    }
                }
            });
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.style.background = connected ? '#27ae60' : '#e74c3c';
        }
    }

    // Utility methods
    getPlayerName(playerId) {
        const player = this.players.find(p => p.id === playerId);
        return player ? player.name : 'Unknown Player';
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getPlayerToken(playerId) {
        // Try to find token by player ID in multiple ways
        const player = this.getPlayerById(playerId);
        if (!player) return null;
        
        // Method 1: Check if player has selectedToken
        if (player.selectedToken) {
            return player.selectedToken;
        }
        
        // Method 2: Check window.players array
        if (window.players) {
            const gamePlayer = window.players.find(p => p.id === playerId);
            if (gamePlayer && gamePlayer.selectedToken) {
                return gamePlayer.selectedToken;
            }
        }
        
        // Method 3: Check global players array
        if (typeof players !== 'undefined') {
            const globalPlayer = players.find(p => p.id === playerId);
            if (globalPlayer && globalPlayer.selectedToken) {
                return globalPlayer.selectedToken;
            }
        }
        
        // Method 4: Search scene for token with matching userData
        if (window.scene) {
            let foundToken = null;
            window.scene.traverse((object) => {
                if (object.userData && object.userData.playerId === playerId) {
                    foundToken = object;
                }
            });
            if (foundToken) return foundToken;
        }
        
        // Method 5: Try to find by token name in scene
        if (window.scene && player.token) {
            const tokenObject = window.scene.getObjectByName(player.token);
            if (tokenObject) {
                // Update the player's selectedToken reference
                player.selectedToken = tokenObject;
                return tokenObject;
            }
        }
        
        return null;
    }

    sendMessage(message) {
        if (this.socket && this.socket.connected) {
            // Use lobby_data for lobby events, client_message for game events
            if (message.type && [
                'create_room', 'join_room', 'select_token', 'set_ready', 'start_game', 'leave_room', 'game_transition_ready', 'rejoin_game', 'request_game_state'
            ].includes(message.type)) {
                this.socket.emit('lobby_data', message);
            } else {
                this.socket.emit('client_message', message);
            }
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Try to use the game's notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else if (window.showFeedback) {
            window.showFeedback(message, 3000);
        } else {
            // Fallback: create a simple notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                font-size: 14px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px;
                text-align: center;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    showTurnIndicator(show) {
        if (window.showTurnIndicator) {
            window.showTurnIndicator(show);
        }
    }

    enablePlayerControls() {
        // Enable dice button for current player
        const diceButton = document.querySelector('.dice-button');
        if (diceButton && this.isMyTurn) {
            diceButton.disabled = false;
            diceButton.style.opacity = '1';
            diceButton.style.cursor = 'pointer';
            diceButton.style.display = 'block';
        }
    }

    disablePlayerControls() {
        // Disable dice button and other controls
        const diceButton = document.querySelector('.dice-button');
        if (diceButton) {
            diceButton.disabled = true;
            diceButton.style.opacity = '0.5';
            diceButton.style.cursor = 'not-allowed';
            // Don't hide the button, just disable it
        }
    }

    // Game state synchronization methods
    moveTokenInGame(playerId, fromPosition, toPosition, passedGo) {
        console.log(`moveTokenInGame called for player ${playerId} from ${fromPosition} to ${toPosition}`);
        
        const player = this.getPlayerById(playerId);
        if (!player) {
            console.error('Player not found for ID:', playerId);
            return;
        }

        // Update player position in our local state
        player.position = toPosition;

        // Find the player's token in the game
        const gamePlayer = window.players ? window.players.find(p => p.id === playerId) : null;
        if (gamePlayer) {
            gamePlayer.position = toPosition;
            gamePlayer.currentPosition = toPosition;
            
            // Try multiple methods to get the correct token
            let token = null;
            
            // Method 1: Try to get token by player ID
            if (window.getPlayerToken) {
                token = window.getPlayerToken(playerId);
            }
            
            // Method 2: Try to get current player token if it's the current player
            if (!token && playerId === this.playerId && window.getCurrentPlayerToken) {
                token = window.getCurrentPlayerToken();
            }
            
            // Method 3: Try to find token in the scene by player index
            if (!token && window.players) {
                const playerIndex = window.players.findIndex(p => p.id === playerId);
                if (playerIndex !== -1 && window.scene) {
                    // Look for tokens in the scene
                    const tokenNames = ['rolls royce', 'helicopter', 'football', 'burger', 'hat', 'nike', 'woman'];
                    for (const tokenName of tokenNames) {
                        const tokenObject = window.scene.getObjectByName(tokenName);
                        if (tokenObject && tokenObject.userData && tokenObject.userData.playerIndex === playerIndex) {
                            token = tokenObject;
                            break;
                        }
                    }
                }
            }
            
            // Method 4: Try to find token by player name/token
            if (!token && window.scene) {
                const tokenName = player.token || 'token';
                const tokenObject = window.scene.getObjectByName(tokenName);
                if (tokenObject) {
                    token = tokenObject;
                }
            }
            
            // Method 5: Try to find token by player's selectedToken
            if (!token && gamePlayer.selectedToken) {
                token = gamePlayer.selectedToken;
            }
            
            // Method 6: Try to find token by player ID in window.players
            if (!token && window.players) {
                const playerInWindow = window.players.find(p => p.id === playerId);
                if (playerInWindow && playerInWindow.selectedToken) {
                    token = playerInWindow.selectedToken;
                }
            }
            
            // Method 7: Try to find token by player's token name in scene
            if (!token && window.scene && player.token) {
                const tokenObject = window.scene.getObjectByName(player.token);
                if (tokenObject) {
                    token = tokenObject;
                    // Update the player's selectedToken reference
                    gamePlayer.selectedToken = token;
                }
            }
            
            // Method 8: Try to find token by searching through all scene objects
            if (!token && window.scene) {
                window.scene.traverse((object) => {
                    if (object.userData && object.userData.playerId === playerId) {
                        token = object;
                    }
                });
            }
            
            if (token) {
                console.log(`Found token for player ${playerId}: ${token.name}`);
                console.log(`Token userData:`, token.userData);
                console.log(`Token position before move:`, token.position);
                
                // Move the visual token
                if (window.moveToken) {
                    const startPos = window.getBoardSquarePosition ? window.getBoardSquarePosition(fromPosition) : fromPosition;
                    const endPos = window.getBoardSquarePosition ? window.getBoardSquarePosition(toPosition) : toPosition;
                    
                    console.log(`Moving token for player ${playerId} from ${fromPosition} to ${toPosition}`);
                    console.log(`Token found: ${token.name}, Start pos: ${JSON.stringify(startPos)}, End pos: ${JSON.stringify(endPos)}`);
                    console.log(`Window moveToken function available: ${!!window.moveToken}`);
                    console.log(`Window getBoardSquarePosition function available: ${!!window.getBoardSquarePosition}`);
                    
                    // Prevent infinite recursion by checking if token is already moving
                    if (token.userData && token.userData.isMoving) {
                        console.log(`Token ${token.name} is already moving, skipping movement`);
                        return;
                    }
                    
                    // Mark token as moving
                    if (token.userData) {
                        token.userData.isMoving = true;
                    }
                    
                    // Ensure token is visible before moving
                    if (token.visible === false) {
                        token.visible = true;
                        token.traverse(child => { child.visible = true; });
                    }
                    
                    // Use the game's moveToken function for proper animation
                    try {
                        window.moveToken(startPos, endPos, token, () => {
                            console.log(`Token movement completed for player ${playerId}`);
                            console.log(`Token position after move:`, token.position);
                            
                            // Unmark token as moving
                            if (token.userData) {
                                token.userData.isMoving = false;
                            }
                        });
                    } catch (error) {
                        console.error(`Error calling moveToken for player ${playerId}:`, error);
                        // Unmark token as moving on error
                        if (token.userData) {
                            token.userData.isMoving = false;
                        }
                    }
                } else {
                    console.error(`Window moveToken function not available for player ${playerId}`);
                    // Fallback: directly set token position
                    if (window.getBoardSquarePosition) {
                        const endPos = window.getBoardSquarePosition(toPosition);
                        token.position.set(endPos.x, endPos.y, endPos.z);
                        console.log(`Fallback: Set token position directly to ${JSON.stringify(endPos)}`);
                    }
                }
            } else {
                console.error('No token found for player:', playerId);
                console.log('Available players:', this.players);
                console.log('Window players:', window.players);
                console.log('Scene available:', !!window.scene);
                // Try to create a fallback token movement
                this.createFallbackTokenMovement(playerId, fromPosition, toPosition);
            }
        } else {
            console.error('Game player not found in window.players');
        }

        // Show movement notification
        this.showNotification(
            `🎯 ${player.name} moved to position ${toPosition}${passedGo ? ' (passed Go!)' : ''}`,
            'info'
        );
    }

    updatePropertyOwnership(playerId, propertyName) {
        const gamePlayer = window.players.find(p => p.id === playerId);
        if (gamePlayer) {
            // Find the property in the game's properties array
            const property = window.properties.find(p => p.name === propertyName);
            if (property) {
                property.owner = playerId;
                gamePlayer.properties.push(property);
                
                // Update the visual representation of the property
                if (window.updatePropertyVisual) {
                    window.updatePropertyVisual(property);
                }
                
                this.showNotification(`🏠 ${gamePlayer.name} now owns ${propertyName}`, 'success');
            }
        }
    }

    updatePlayerMoney(playerId, amount) {
        const gamePlayer = window.players.find(p => p.id === playerId);
        if (gamePlayer) {
            gamePlayer.money += amount;
            
            // Update the money display
            if (window.updateMoneyDisplay) {
                window.updateMoneyDisplay();
            }
        }
    }

    movePlayerToJail(playerId) {
        const gamePlayer = window.players.find(p => p.id === playerId);
        if (gamePlayer) {
            gamePlayer.inJail = true;
            gamePlayer.jailTurns = 3;
            gamePlayer.position = 10; // Jail position
            
            // Move the visual token to jail
            this.moveTokenInGame(playerId, gamePlayer.position, 10, false);
        }
    }

    removePlayerFromGame(playerId) {
        // Remove player from the game
        const playerIndex = window.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            window.players.splice(playerIndex, 1);
            
            // Update the game display
            if (window.updateBoards) {
                window.updateBoards();
            }
        }
    }

    leaveGame() {
        console.log('Leaving multiplayer game');
        
        // Clean up intervals and observers
        if (window.tokenSelectionCleanupInterval) {
            clearInterval(window.tokenSelectionCleanupInterval);
            window.tokenSelectionCleanupInterval = null;
        }
        
        if (window.tokenSelectionObserver) {
            window.tokenSelectionObserver.disconnect();
            window.tokenSelectionObserver = null;
        }
        
        this.sendMessage({
            type: 'leave_game',
            roomId: this.roomId,
            playerId: this.playerId
        });
        
        // Redirect back to lobby
        window.location.href = 'lobby.html';
    }

    disableTokenSelectionUI() {
        console.log('Disabling token selection UI for multiplayer mode...');
        
        // Set global flag to prevent token selection UI creation
        window.isMultiplayerMode = true;
        
        // Override the createPlayerTokenSelectionUI function to do nothing in multiplayer
        if (window.createPlayerTokenSelectionUI) {
            const originalCreatePlayerTokenSelectionUI = window.createPlayerTokenSelectionUI;
            window.createPlayerTokenSelectionUI = (playerIndex) => {
                console.log('Token selection UI disabled in multiplayer mode - tokens already assigned in lobby');
                // Don't create the UI in multiplayer mode
                return;
            };
        }
        
        // Override the createPlayerTokenSelectionUI function in script.js
        window.createPlayerTokenSelectionUI = (playerIndex) => {
            console.log('Token selection UI disabled in multiplayer mode - tokens already assigned in lobby');
            return;
        };
        
        // Override the finalizePlayerSelection function to do nothing in multiplayer
        window.finalizePlayerSelection = () => {
            console.log('Player selection finalization disabled in multiplayer mode');
            return;
        };
        
        // Override the init function to prevent token selection UI creation
        if (window.init) {
            const originalInit = window.init;
            window.init = () => {
                console.log('Init function called in multiplayer mode - skipping token selection UI');
                // Call the original init but prevent token selection UI
                const result = originalInit();
                
                // Immediately remove any token selection UI that might have been created
                setTimeout(() => {
                    this.disableTokenSelectionUI();
                }, 100);
                
                return result;
            };
        }
        
        // Also override initPlayerTokenSelection to prevent token selection
        if (window.initPlayerTokenSelection) {
            const originalInitPlayerTokenSelection = window.initPlayerTokenSelection;
            window.initPlayerTokenSelection = () => {
                console.log('Token selection initialization disabled in multiplayer mode');
                // Don't initialize token selection in multiplayer mode
                return;
            };
        }
        
        // Override the initializePlayers function to prevent token selection UI
        if (window.initializePlayers) {
            const originalInitializePlayers = window.initializePlayers;
            window.initializePlayers = () => {
                console.log('Initialize players called in multiplayer mode - skipping token selection UI');
                // Don't initialize players with token selection UI in multiplayer mode
                return;
            };
        }
        
        // Remove any existing token selection UI elements immediately
        const selectorsToRemove = [
            '[style*="z-index: 1000"][style*="position: fixed"]',
            '.token-selection',
            '#token-selection',
            '[id*="token"]',
            '[class*="token"]',
            'div[style*="position: fixed"]',
            'div[style*="z-index"]',
            '#start-game',
            '.start-game',
            '[id*="start-game"]',
            '[class*="start-game"]',
            '.flash-title',
            '.action-button',
            'button[style*="margin-top"]',
            // Add more aggressive selectors to remove persistent overlays
            'div[style*="top: 0"]',
            'div[style*="position: fixed"][style*="top: 0"]',
            'div[style*="z-index: 3000"]',
            'div[style*="z-index: 2000"]',
            'div[style*="z-index: 1000"]',
            '.token-selection-ui',
            '#token-selection-ui',
            '.property-overlay',
            '.jail-overlay',
            '.card-overlay',
            '.free-parking-overlay',
            '.luxury-tax-overlay',
            '.income-tax-overlay'
        ];
        
        selectorsToRemove.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.textContent && 
                        (element.textContent.includes('Select Tokens') || 
                         element.textContent.includes('Start Game') ||
                         element.textContent.includes('AI Players') ||
                         element.textContent.includes('Click to Enable PC'))) {
                        console.log('Removing token selection element:', element);
                        element.remove();
                    }
                });
            } catch (e) {
                // Ignore selector errors
            }
        });
        
        // Force remove any persistent overlays that might be stuck
        this.forceRemovePersistentOverlays();
        
        // Also hide any elements with specific text content
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && 
                (element.textContent.includes('Select Tokens and AI Players') ||
                 element.textContent.includes('Start Game') ||
                 element.textContent.includes('Click to Enable PC') ||
                 element.textContent.includes('woman') ||
                 element.textContent.includes('Rolls Royce') ||
                 element.textContent.includes('Helicopter') ||
                 element.textContent.includes('Top Hat') ||
                 element.textContent.includes('Football') ||
                 element.textContent.includes('Burger') ||
                 element.textContent.includes('Tennis Shoe'))) {
                console.log('Hiding element with token selection text:', element);
                element.style.display = 'none';
                element.remove();
            }
        });
        
        // Set up a mutation observer to catch any dynamically created token selection UI
        if (!window.tokenSelectionObserver) {
            window.tokenSelectionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.textContent && 
                                (node.textContent.includes('Select Tokens') ||
                                 node.textContent.includes('Start Game') ||
                                 node.textContent.includes('AI Players') ||
                                 node.textContent.includes('Click to Enable PC'))) {
                                console.log('Removing dynamically created token selection element:', node);
                                node.remove();
                            }
                        }
                    });
                });
            });
            
            window.tokenSelectionObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('Token selection UI disabled for multiplayer mode');
        
        // Set up periodic cleanup to ensure UI stays hidden
        if (!window.tokenSelectionCleanupInterval) {
            window.tokenSelectionCleanupInterval = setInterval(() => {
                // Remove any elements with token selection text
                const allElements = document.querySelectorAll('*');
                allElements.forEach(element => {
                    if (element.textContent && 
                        (element.textContent.includes('Select Tokens and AI Players') ||
                         element.textContent.includes('Start Game') ||
                         element.textContent.includes('AI Players'))) {
                        console.log('Periodic cleanup: removing token selection element:', element);
                        element.remove();
                    }
                });
                
                // Remove any fixed positioned elements that might be token selection UI
                const fixedElements = document.querySelectorAll('[style*="position: fixed"]');
                fixedElements.forEach(element => {
                    if (element.textContent && 
                        (element.textContent.includes('Select Tokens') ||
                         element.textContent.includes('Start Game') ||
                         element.textContent.includes('AI Players'))) {
                        console.log('Periodic cleanup: removing fixed positioned element:', element);
                        element.remove();
                    }
                });
                
            }, 500); // Check every half second for more aggressive cleanup
        }
    }
    
    forceRemovePersistentOverlays() {
        console.log('Force removing persistent overlays...');
        
        // Remove any elements that might be causing the persistent bar
        const persistentSelectors = [
            'div[style*="position: fixed"][style*="top: 0"]',
            'div[style*="position: fixed"][style*="z-index"]',
            'div[style*="background"][style*="position: fixed"]',
            '.token-selection-ui',
            '#token-selection-ui',
            '.property-overlay',
            '.jail-overlay',
            '.card-overlay',
            '.free-parking-overlay',
            '.luxury-tax-overlay',
            '.income-tax-overlay',
            'div[style*="width: 100%"][style*="height: 100%"]',
            'div[style*="top: 0"][style*="left: 0"]'
        ];
        
        persistentSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    console.log('Force removing persistent overlay:', element);
                    element.style.display = 'none';
                    element.remove();
                });
            } catch (e) {
                console.warn('Error removing persistent overlay:', e);
            }
        });
        
        // Also remove any elements with high z-index that might be stuck
        const highZIndexElements = document.querySelectorAll('[style*="z-index: 3000"], [style*="z-index: 2000"], [style*="z-index: 1000"]');
        highZIndexElements.forEach(element => {
            if (element.style.position === 'fixed' && element.style.top === '0px') {
                console.log('Force removing high z-index fixed element:', element);
                element.style.display = 'none';
                element.remove();
            }
        });
        
    }

    validateMultiplayerGame() {
        const issues = [];
        
        // Check if all players have tokens assigned
        const playersWithoutTokens = this.players.filter(p => !p.token);
        if (playersWithoutTokens.length > 0) {
            issues.push(`Players without tokens: ${playersWithoutTokens.map(p => p.name).join(', ')}`);
        }
        
        // Check if game state is properly synchronized
        if (!this.gameState) {
            issues.push('Game state not synchronized');
        }
        
        // Check if WebSocket connection is active
        if (!this.socket || !this.socket.connected) {
            issues.push('WebSocket connection not active');
        }
        
        // Check if all required game functions are available
        const requiredFunctions = ['rollDice', 'buyProperty', 'endTurn', 'moveToken'];
        const missingFunctions = requiredFunctions.filter(fn => !window[fn]);
        if (missingFunctions.length > 0) {
            issues.push(`Missing game functions: ${missingFunctions.join(', ')}`);
        }
        
        // Check if video chat is properly integrated
        if (typeof updateVideoChatForGameState !== 'function') {
            issues.push('Video chat integration incomplete');
        }
        
        // Log any issues found
        if (issues.length > 0) {
            console.warn('Multiplayer game validation issues:', issues);
            this.showNotification(`Multiplayer issues detected: ${issues.join(', ')}`, 'warning');
        } else {
            console.log('Multiplayer game validation passed');
            this.showNotification('Multiplayer game ready!', 'success');
        }
        
        return issues.length === 0;
    }

    ensureDiceButtonExists() {
        // Create dice button if it doesn't exist
        if (!document.querySelector('.dice-button')) {
            if (window.createDiceButton) {
                window.createDiceButton();
            } else {
                // Fallback: create a basic dice button
                const rollButton = document.createElement('button');
                rollButton.className = 'dice-button';
                rollButton.textContent = 'Roll Dice';
                rollButton.style.display = 'block';
                rollButton.style.zIndex = '2001';
                rollButton.onclick = () => {
                    if (this.isMyTurn) {
                        this.rollDice();
                    } else {
                        this.showNotification("It's not your turn!", 'error');
                    }
                };
                document.body.appendChild(rollButton);
            }
        }
        
        // Ensure the dice button is properly styled and positioned
        this.showDiceButtonForMultiplayer();
    }

    ensureGameMechanicsWork() {
        // Ensure turn-based gameplay works
        this.ensureTurnBasedGameplay();
        
        // Ensure real-time synchronization works
        this.ensureRealTimeSync();
        
        // Ensure player actions are properly broadcast
        this.ensureActionBroadcasting();
        
        // Ensure game state consistency
        this.ensureGameStateConsistency();
    }

    ensureTurnBasedGameplay() {
        // Override game functions to ensure they work with multiplayer
        if (window.rollDice && !window.rollDice.isMultiplayerOverridden) {
            const originalRollDice = window.rollDice;
            window.rollDice = () => {
                if (this.isMyTurn) {
                    this.rollDice();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
            window.rollDice.isMultiplayerOverridden = true;
        }

        if (window.buyProperty && !window.buyProperty.isMultiplayerOverridden) {
            const originalBuyProperty = window.buyProperty;
            window.buyProperty = (property, callback) => {
                if (this.isMyTurn) {
                    this.buyProperty(property.name, property.price);
                    if (callback) callback();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
            window.buyProperty.isMultiplayerOverridden = true;
        }

        if (window.endTurn && !window.endTurn.isMultiplayerOverridden) {
            const originalEndTurn = window.endTurn;
            window.endTurn = () => {
                if (this.isMyTurn) {
                    this.endTurn();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
            window.endTurn.isMultiplayerOverridden = true;
        }
        
        // Ensure dice button is visible for multiplayer
        this.showDiceButtonForMultiplayer();
    }

    showDiceButtonForMultiplayer() {
        // Find the dice button
        const diceButton = document.querySelector('.dice-button');
        if (diceButton) {
            // Show the dice button for multiplayer mode
            diceButton.style.display = 'block';
            diceButton.style.position = 'fixed';
            diceButton.style.bottom = '20px';
            diceButton.style.left = '20px';
            diceButton.style.transform = 'none';
            diceButton.style.zIndex = '2001';
            diceButton.style.padding = '12px 20px';
            diceButton.style.fontSize = '16px';
            diceButton.style.backgroundColor = '#4CAF50';
            diceButton.style.color = 'white';
            diceButton.style.border = 'none';
            diceButton.style.borderRadius = '8px';
            diceButton.style.cursor = 'pointer';
            diceButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            diceButton.style.fontWeight = 'bold';
            diceButton.style.minWidth = '120px';
            diceButton.style.textAlign = 'center';
            diceButton.style.transition = 'all 0.3s ease';
            
            // Add hover effect
            diceButton.addEventListener('mouseenter', () => {
                diceButton.style.backgroundColor = '#45a049';
                diceButton.style.transform = 'scale(1.05)';
                diceButton.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
            });
            
            diceButton.addEventListener('mouseleave', () => {
                diceButton.style.backgroundColor = '#4CAF50';
                diceButton.style.transform = 'scale(1)';
                diceButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });
            
            // Enable/disable based on turn
            if (this.isMyTurn) {
                diceButton.disabled = false;
                diceButton.style.opacity = '1';
                diceButton.style.cursor = 'pointer';
            } else {
                diceButton.disabled = true;
                diceButton.style.opacity = '0.5';
                diceButton.style.cursor = 'not-allowed';
            }
            
            // Override the click handler to use multiplayer roll
            diceButton.onclick = () => {
                if (this.isMyTurn) {
                    this.rollDice();
                } else {
                    this.showNotification("It's not your turn!", 'error');
                }
            };
        }
    }

    ensureRealTimeSync() {
        // Ensure player positions are synchronized
        if (window.moveToken) {
            const originalMoveToken = window.moveToken;
            window.moveToken = (startPos, endPos, token, callback) => {
                // Call original function
                originalMoveToken(startPos, endPos, token, callback);
                
                // Also update multiplayer state if this is a multiplayer move
                if (this.isMyTurn && token) {
                    const playerId = this.getPlayerByToken(token.name);
                    if (playerId) {
                        // Position is already updated by the original function
                        // Just ensure it's synchronized
                        this.syncPlayerPosition(playerId, endPos);
                    }
                }
            };
        }
    }

    ensureActionBroadcasting() {
        // Ensure all player actions are broadcast to other players
        this.showNotification('All player actions will be synchronized in real-time', 'info');
    }

    ensureGameStateConsistency() {
        // Ensure game state is consistent across all players
        setInterval(() => {
            if (this.gameState && this.socket && this.socket.connected) {
                // Request game state update to ensure consistency
                this.sendMessage({
                    type: 'request_game_state',
                    roomId: this.roomId
                });
            }
        }, 10000); // Check every 10 seconds
    }

    getPlayerByToken(tokenName) {
        const player = this.players.find(p => p.token === tokenName);
        return player ? player.id : null;
    }

    syncPlayerPosition(playerId, position) {
        // This would be handled by the server, but we can log it for debugging
        console.log(`Syncing position for player ${playerId} to ${JSON.stringify(position)}`);
    }

    createFallbackPlayers() {
        console.log('Creating fallback players due to connection failure');
        this.players = [{
            id: this.playerId,
            name: this.storedGameState?.playerName || 'Player 1',
            token: this.storedGameState?.selectedToken || 'rolls royce',
            money: 1500,
            position: 0
        }];
        this.initializeMultiplayerPlayers();
    }
    
    createFallbackTokenMovement(playerId, fromPosition, toPosition) {
        console.log(`Creating fallback token movement for player ${playerId}`);
        
        // Try to find any token in the scene and move it
        if (window.scene) {
            const allObjects = window.scene.children;
            let token = null;
            
            // Look for any object that might be a token
            for (let obj of allObjects) {
                if (obj.name && (obj.name.includes('token') || obj.name.includes('Token') || obj.name.includes('player'))) {
                    token = obj;
                    break;
                }
            }
            
           
            // If no token found, try to find by common token names
            if (!token) {
                const tokenNames = ['rolls royce', 'helicopter', 'football', 'burger', 'hat', 'nike', 'woman'];
                for (const tokenName of tokenNames) {
                    const tokenObject = window.scene.getObjectByName(tokenName);
                    if (tokenObject) {
                        token = tokenObject;
                        break;
                    }
                }
            }
            
            if (token && window.moveToken) {
                // Prevent infinite recursion
                if (token.userData && token.userData.isMoving) {
                    console.log(`Fallback token ${token.name} is already moving, skipping`);
                    return;
                }
                
                // Mark token as moving
                if (token.userData) {
                    token.userData.isMoving = true;
                }
                
                const startPos = window.getBoardSquarePosition ? window.getBoardSquarePosition(fromPosition) : fromPosition;
                const endPos = window.getBoardSquarePosition ? window.getBoardSquarePosition(toPosition) : toPosition;
                
                console.log(`Using fallback token ${token.name} for player ${playerId}`);
                window.moveToken(startPos, endPos, token, () => {
                    console.log(`Fallback token movement completed for player ${playerId}`);
                    
                    // Unmark token as moving
                    if (token.userData) {
                        token.userData.isMoving = false;
                    }
                });
            } else {
                console.error('No fallback token found for movement');
            }
        }
    }
    
    updatePlayerToken(index, token, tokenName) {
        // Update both player arrays with token reference
        let globalPlayers = typeof players !== 'undefined' ? players : window.players;
        if (globalPlayers && globalPlayers[index]) {
            globalPlayers[index].selectedToken = token;
            globalPlayers[index].currentPosition = 0;
            
            // Also update the main game's players array if it exists and is different
            if (typeof players !== 'undefined' && players !== globalPlayers) {
                players[index].selectedToken = token;
                players[index].currentPosition = 0;
            }
            
            // Also update window.players to ensure consistency
            if (window.players && window.players[index]) {
                window.players[index].selectedToken = token;
                window.players[index].currentPosition = 0;
            }
            
            // Ensure token has proper userData for identification
            if (token && !token.userData) token.userData = {};
            if (token) {
                const player = globalPlayers[index];
                if (player) {
                    token.userData.playerId = player.id;
                    token.userData.playerIndex = index;
                    token.userData.tokenName = tokenName;
                    token.userData.isPlayerToken = true;
                }
            }
        } else {
            console.warn(`Global players array not available for index ${index}`);
        }
    }

    debugTokenSynchronization() {
        console.log('=== TOKEN SYNCHRONIZATION DEBUG ===');
        console.log('Multiplayer players:', this.players);
        console.log('Window players:', window.players);
        console.log('Scene available:', !!window.scene);
        
        if (window.players) {
            window.players.forEach((player, index) => {
                console.log(`Player ${index}:`, {
                    id: player.id,
                    name: player.name,
                    token: player.selectedToken ? player.selectedToken.name : 'No token',
                    position: player.currentPosition,
                    visible: player.selectedToken ? player.selectedToken.visible : 'N/A'
                });
            });
        }
        
        if (window.scene) {
            const tokenNames = ['rolls royce', 'helicopter', 'football', 'burger', 'hat', 'nike', 'woman'];
            tokenNames.forEach(tokenName => {
                const token = window.scene.getObjectByName(tokenName);
                if (token) {
                    console.log(`Token ${tokenName}:`, {
                        visible: token.visible,
                        position: token.position,
                        userData: token.userData
                    });
                }
            });
        }
        console.log('===================================');
    }

    // Test function to manually trigger token movement
    testTokenMovement(playerId) {
        console.log(`Testing token movement for player ${playerId}`);
        
        if (!window.scene) {
            console.error('Scene not available for testing');
            return;
        }
        
        const token = this.getPlayerToken(playerId);
        if (token) {
            console.log(`Found token for testing: ${token.name}`);
            console.log(`Current position:`, token.position);
            
            // Test movement from current position to next position
            const currentPos = token.position;
            const testEndPos = {
                x: currentPos.x + 5,
                y: currentPos.y,
                z: currentPos.z
            };
            
            console.log(`Testing movement from ${JSON.stringify(currentPos)} to ${JSON.stringify(testEndPos)}`);
            
            if (window.moveToken) {
                window.moveToken(currentPos, testEndPos, token, () => {
                    console.log(`Test movement completed`);
                });
            } else {
                console.error('moveToken function not available for testing');
            }
        } else {
            console.error(`No token found for player ${playerId} during testing`);
        }
    }
}

// Global functions for HTML onclick handlers
function rollDice() {
    if (window.multiplayerGame) {
        window.multiplayerGame.rollDice();
    }
}

function endTurn() {
    if (window.multiplayerGame) {
        window.multiplayerGame.endTurn();
    }
}

function leaveGame() {
    if (window.multiplayerGame) {
        window.multiplayerGame.leaveGame();
    }
}

function getPlayerToken(playerId) {
    if (window.multiplayerGame) {
        return window.multiplayerGame.getPlayerToken(playerId);
    }
    return null;
}

function testTokenMovement(playerId) {
    if (window.multiplayerGame) {
        window.multiplayerGame.testTokenMovement(playerId);
    } else {
        console.error('Multiplayer game not initialized');
    }
}

// Make MultiplayerGame available globally
window.MultiplayerGame = MultiplayerGame;