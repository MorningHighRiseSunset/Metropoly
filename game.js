// Game page logic for Metropoly, refactored for reliable multiplayer handoff
const socket = new WebSocket('wss://metropoly.onrender.com');

const params = new URLSearchParams(window.location.search);
const roomId = params.get('room');
const playerId = params.get('player');
let selectedToken = sessionStorage.getItem('selectedToken');

console.log('[game.js] Loaded. roomId:', roomId, 'playerId:', playerId);

// On socket open, send rejoin_game
socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    type: 'rejoin_game',
    roomId,
    playerId,
    selectedToken
  }));
});

// Listen for game state updates and actions
socket.addEventListener('message', event => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'game_state_update' || data.type === 'game_started') {
      // Update game UI and state
      // ...
    }
    if (data.type === 'dice_rolled') {
      // Animate token movement
      // ...
    }
    if (data.type === 'error') {
      // Show error to user
      console.error('[game.js] Server error:', data.message);
    }
  } catch (err) {
    console.error('[game.js] Error parsing server message:', err);
  }
});

// Example: Roll dice button
const rollDiceBtn = document.getElementById('roll-dice-btn');
if (rollDiceBtn) {
  rollDiceBtn.onclick = () => {
    socket.send(JSON.stringify({
      type: 'game_action',
      action: 'roll_dice',
      data: { playerId }
    }));
  };
}
