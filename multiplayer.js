// Multiplayer client for Metropoly
(function(){
  class MultiplayerGame {
    constructor(roomId, playerId) {
      this.roomId = roomId;
      this.playerId = playerId;
      this.ws = null;
      this.gameStarted = false;
      this.serverUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'ws://localhost:3000'
        : 'wss://metropoly.onrender.com';
      this.connect();
    }
    connect() {
      try {
        this.ws = new WebSocket(this.serverUrl);
        this.ws.onopen = () => {
          this.sendMessage({ type: 'rejoin_game', roomId: this.roomId, playerId: this.playerId, selectedToken: sessionStorage.getItem('selectedToken') });
        };
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'game_started' || data.type === 'game_state_update') {
              // Optionally hydrate UI
            }
            if (data.type === 'dice_rolled') {
              const spaces = Number(data.total) || 0;
              if (typeof showDiceResult === 'function') {
                showDiceResult(spaces, data.dice1, data.dice2);
              }
              setTimeout(() => {
                if (typeof moveTokenToNewPositionWithCollisionAvoidance === 'function') {
                  moveTokenToNewPositionWithCollisionAvoidance(spaces, () => {
                    if (typeof window.updateMoneyDisplay === 'function') {
                      window.updateMoneyDisplay();
                    }
                  });
                }
              }, 800);
            }
          } catch(e) { console.error('[multiplayer] message error', e); }
        };
      } catch(e) { console.error('[multiplayer] connect error', e); }
    }
    sendMessage(msg) {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(msg));
        }
      } catch(e) { console.error('[multiplayer] send error', e); }
    }
    showNotification(text, level = 'info') {
      try { window.showNotification?.(text, level); } catch(_) {}
    }
    setupGame() {
      window.multiplayerGame = this;
      if (typeof window.init === 'function') {
        window.init();
      } else {
        document.addEventListener('scriptLoaded', () => window.init && window.init(), { once: true });
      }
    }
    leaveGame() {
      try {
        this.sendMessage({ type: 'leave_room', roomId: this.roomId, playerId: this.playerId });
        this.ws && this.ws.close();
      } catch(_) {}
    }
  }
  window.MultiplayerGame = MultiplayerGame;
})();