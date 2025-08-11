// Room page logic for Metropoly, refactored for reliable multiplayer handoff
const socket = new WebSocket('wss://metropoly.onrender.com');

const params = new URLSearchParams(window.location.search);
const roomId = params.get('room');
let playerId = sessionStorage.getItem('playerId');
let selectedToken = null;
let isReady = false;

// UI elements
const tokenButtons = document.querySelectorAll('.token-btn');
const readyBtn = document.getElementById('ready-btn');
const leaveBtn = document.getElementById('leave-btn');
const statusDiv = document.getElementById('room-status');
const roomCodeDiv = document.getElementById('room-code');

console.log('[room.js] Loaded. roomId:', roomId);

if (roomCodeDiv && roomId) {
  roomCodeDiv.textContent = `Room code: ${roomId}`;
}

// Token selection
if (tokenButtons) {
  tokenButtons.forEach(btn => {
    btn.onclick = () => {
      selectedToken = btn.dataset.token;
      sessionStorage.setItem('selectedToken', selectedToken);
      socket.send(JSON.stringify({
        type: 'select_token',
        roomId,
        playerId,
        tokenName: selectedToken
      }));
      tokenButtons.forEach(b => b.disabled = true);
      btn.classList.add('selected');
      statusDiv.textContent = `You picked ${selectedToken}`;
      readyBtn.disabled = false;
    };
  });
}

// Ready button
if (readyBtn) {
  readyBtn.onclick = () => {
    selectedToken = selectedToken || sessionStorage.getItem('selectedToken');
    if (!selectedToken) {
      statusDiv.textContent = 'Pick a token first!';
      return;
    }
    isReady = true;
    sessionStorage.setItem('selectedToken', selectedToken);
    socket.send(JSON.stringify({
      type: 'set_ready',
      roomId,
      playerId,
      ready: true
    }));
    readyBtn.disabled = true;
    statusDiv.textContent = 'Waiting for other players...';
  };
}

// Leave button
if (leaveBtn) {
  leaveBtn.onclick = () => {
    socket.send(JSON.stringify({
      type: 'leave_room',
      roomId,
      playerId
    }));
    sessionStorage.removeItem('selectedToken');
    window.location.href = 'lobby.html';
  };
}

// Listen for game start
socket.addEventListener('message', event => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'game_started') {
      // Save all session info for game page
      sessionStorage.setItem('roomId', roomId);
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('selectedToken', selectedToken);
      window.location.href = `game.html?room=${roomId}&player=${playerId}`;
    }
    if (data.type === 'room_info') {
      // Optionally update UI with room info
      // ...
    }
    if (data.type === 'player_ready_changed') {
      // Optionally update UI with ready status
      // ...
    }
  } catch (err) {
    console.error('[room.js] Error parsing server message:', err);
  }
});

// On socket open, send join_room
socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    type: 'join_room',
    roomId,
    playerId,
    playerName: sessionStorage.getItem('playerName') || 'Player'
  }));
});
