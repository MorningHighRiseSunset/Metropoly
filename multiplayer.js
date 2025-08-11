// Multiplayer client for Metropoly
(function(){
  class MultiplayerGame {
    constructor(roomId, playerId) {
      this.roomId = roomId;
      this.playerId = playerId?.toString();
      this.ws = null;
      this.players = [];
      this.currentPlayerIndex = 0;
      this.gameStarted = false;
      this.connected = false;
      this._pendingMessages = [];

      this.connectWebSocket();
    }

    getServerUrl() {
      try {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return 'ws://localhost:3000';
      } catch(_) {}
      return 'wss://metropoly.onrender.com';
    }

    connectWebSocket() {
      const url = this.getServerUrl();
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        console.error('Failed to open WebSocket:', e);
        this.updateConnectionStatus(false);
        return;
      }

      this.ws.onopen = () => {
        this.connected = true;
        this.updateConnectionStatus(true);
        // Rejoin game and request state
        const selectedToken = sessionStorage.getItem('selectedToken');
        this.sendMessage({ type: 'rejoin_game', roomId: this.roomId, playerId: this.playerId, selectedToken });
        this.sendMessage({ type: 'request_game_state' });
        // Flush any queued messages
        this._pendingMessages.splice(0).forEach(msg => this.sendMessage(msg));
      };

      this.ws.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { console.error('WS parse error:', e); return; }
        this.handleServerMessage(data);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.updateConnectionStatus(false);
        // Attempt lightweight reconnect after a delay
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.connectWebSocket();
        }, 2000);
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.updateConnectionStatus(false);
      };
    }

    sendMessage(message) {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ roomId: this.roomId, playerId: this.playerId, ...message }));
        } else {
          this._pendingMessages.push(message);
        }
      } catch (e) {
        console.error('Failed to send WS message:', e, message);
      }
    }

    setupGame() {
      // Ensure we have the latest game state
      this.sendMessage({ type: 'request_game_state' });
    }

    leaveGame() {
      this.sendMessage({ type: 'leave_room' });
    }

    rollDice() {
      // Only allow if it's our turn
      const current = this.players[this.currentPlayerIndex];
      if (!current || (current.id?.toString() !== this.playerId?.toString())) {
        this.showNotification("It's not your turn.", 'warning');
        return;
      }
      this.sendMessage({ type: 'game_action', action: 'roll_dice', data: { playerId: this.playerId } });
    }

    endTurn() {
      this.sendMessage({ type: 'game_action', action: 'end_turn', data: { playerId: this.playerId } });
    }

    showNotification(msg, level = 'info') {
      if (typeof window.showNotification === 'function') {
        try { window.showNotification(msg); return; } catch(_) {}
      }
      // Fallback to notification element
      const el = document.getElementById('notification');
      if (el) {
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
      } else {
        console.log('[Notification]', level, msg);
      }
    }

    updateConnectionStatus(connected) {
      const el = document.getElementById('connection-status');
      if (!el) return;
      el.textContent = connected ? 'Connected' : 'Disconnected';
      el.classList.toggle('status-connected', !!connected);
      el.classList.toggle('status-disconnected', !connected);
    }

    updatePlayersList() {
      const list = document.getElementById('players-list');
      if (!list) return;
      list.innerHTML = '';
      this.players.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'player-info' + (idx === this.currentPlayerIndex ? ' current-player' : '');
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.textContent = (p.token?.[0] || 'P').toUpperCase();
        const details = document.createElement('div');
        details.className = 'player-details';
        const name = document.createElement('div');
        name.textContent = p.name || `Player ${idx+1}`;
        const money = document.createElement('div');
        money.textContent = `$${(p.money ?? 0)}`;
        const token = document.createElement('div');
        token.className = 'player-token';
        token.textContent = p.token || '';
        details.appendChild(name);
        details.appendChild(money);
        row.appendChild(avatar);
        row.appendChild(details);
        row.appendChild(token);
        list.appendChild(row);
      });
    }

    setDiceButtonVisible(visible) {
      const btn = document.querySelector('.dice-button');
      if (btn) btn.style.display = visible ? 'block' : 'none';
      if (typeof window.showTurnIndicator === 'function') {
        try { window.showTurnIndicator(!!visible); } catch(_){}
      }
    }

    applyGameState(gameStateMessage) {
      try {
        // Update local players from server
        const serverPlayers = gameStateMessage.players || [];
        // Ensure window.players exists
        if (!window.players || !Array.isArray(window.players)) {
          window.players = [];
        }
        // Resize local players to match server
        while (window.players.length < serverPlayers.length) window.players.push({});
        while (window.players.length > serverPlayers.length) window.players.pop();

        // Map server players -> local window.players
        serverPlayers.forEach((sp, idx) => {
          const lp = window.players[idx] || {};
          lp.id = sp.id?.toString();
          lp.name = sp.name || lp.name || `Player ${idx+1}`;
          lp.money = Number(sp.money ?? lp.money ?? 1500);
          lp.currentPosition = Number(sp.position ?? lp.currentPosition ?? 0);
          lp.tokenName = sp.token || lp.tokenName || null;
          // Attach token model when available
          if (lp.tokenName && !lp.selectedToken && window.loadedTokenModels && window.loadedTokenModels[lp.tokenName]) {
            lp.selectedToken = window.loadedTokenModels[lp.tokenName];
            // Keep invisible until first movement
            if (lp.selectedToken && lp.selectedToken.visible === false) {
              // leave as-is
            }
          }
          window.players[idx] = lp;
        });

        // Sync our internal reference and current player index
        this.players = window.players;
        const serverIdx = Number(gameStateMessage.currentPlayerIndex ?? gameStateMessage.gameState?.currentTurn ?? 0);
        this.currentPlayerIndex = Math.max(0, Math.min(this.players.length - 1, serverIdx));
        window.currentPlayerIndex = this.currentPlayerIndex;

        // Show dice button only if it's our turn
        const isOurTurn = this.players[this.currentPlayerIndex]?.id?.toString() === this.playerId?.toString();
        this.setDiceButtonVisible(isOurTurn);

        // Update UI
        if (typeof window.updateMoneyDisplay === 'function') {
          try { window.updateMoneyDisplay(); } catch(_){}
        }
        this.updatePlayersList();
      } catch (e) {
        console.error('Failed to apply game state:', e, gameStateMessage);
      }
    }

    handleDiceRolled(data) {
      const rolledPlayerId = data.playerId?.toString();
      const idx = this.players.findIndex(p => p.id?.toString() === rolledPlayerId);
      if (idx === -1) return;

      // Set the local turn to match
      this.currentPlayerIndex = idx;
      window.currentPlayerIndex = idx;

      // Ensure local position matches server's fromPosition before moving
      const lp = this.players[idx];
      if (typeof data.fromPosition === 'number') {
        lp.currentPosition = data.fromPosition;
      }

      // Ensure token model is attached
      if (!lp.selectedToken && lp.tokenName && window.loadedTokenModels && window.loadedTokenModels[lp.tokenName]) {
        lp.selectedToken = window.loadedTokenModels[lp.tokenName];
      }

      // Display simple dice result feedback
      if (typeof window.showFeedback === 'function') {
        try { window.showFeedback(`${lp.name} rolled a ${data.total}`); } catch(_){}
      }

      // Move the token by the rolled total, using the exported movement function
      const spaces = Number(data.total || 0);
      if (typeof window.moveTokenToNewPositionWithCollisionAvoidance === 'function') {
        try {
          window.moveTokenToNewPositionWithCollisionAvoidance(spaces, () => {
            // After movement, let local UI update. Server will drive next actions/turns.
          });
        } catch (e) {
          console.error('Error moving token after dice roll:', e);
        }
      }

      // Update money if passed GO was processed server-side
      if (typeof data.newMoney === 'number') {
        lp.money = data.newMoney;
        if (typeof window.updateMoneyDisplay === 'function') {
          try { window.updateMoneyDisplay(); } catch(_){}
        }
      }
    }

    handleServerMessage(data) {
      switch (data.type) {
        case 'game_state_update':
        case 'game_started': {
          this.applyGameState(data);
          break;
        }
        case 'player_turn': {
          // Server indicates whose turn it is
          const idx = Number(data.currentPlayerIndex ?? 0);
          this.currentPlayerIndex = idx;
          window.currentPlayerIndex = idx;
          const isOurTurn = this.players[idx]?.id?.toString() === this.playerId?.toString();
          this.setDiceButtonVisible(isOurTurn);
          if (isOurTurn) {
            this.showNotification("It's your turn - roll the dice!", 'info');
          }
          this.updatePlayersList();
          break;
        }
        case 'turn_ended': {
          // Move UI to next player
          const idx = Number(data.currentPlayerIndex ?? 0);
          this.currentPlayerIndex = idx;
          window.currentPlayerIndex = idx;
          const isOurTurn = this.players[idx]?.id?.toString() === this.playerId?.toString();
          this.setDiceButtonVisible(isOurTurn);
          this.updatePlayersList();
          break;
        }
        case 'dice_rolled': {
          this.handleDiceRolled(data);
          break;
        }
        case 'property_purchased': {
          // Sync money and notify
          const buyer = this.players.find(p => p.id?.toString() === data.playerId?.toString());
          if (buyer) buyer.money = Number(data.newMoney ?? buyer.money);
          if (typeof window.updateMoneyDisplay === 'function') {
            try { window.updateMoneyDisplay(); } catch(_){}
          }
          this.showNotification(`${data.playerName} bought ${data.propertyName} for $${data.price}`);
          break;
        }
        case 'rent_paid': {
          this.showNotification(`${data.playerName} paid rent for ${data.propertyName}`);
          break;
        }
        case 'error': {
          this.showNotification(data.message || 'Server error', 'error');
          break;
        }
        default: {
          // console.log('Unhandled message:', data);
        }
      }
    }
  }

  window.MultiplayerGame = MultiplayerGame;
})();