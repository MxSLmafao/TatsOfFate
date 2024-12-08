const { Game } = require('./Game.js');

class GameManager {
    constructor() {
        this.games = new Map();
        this.playerToGame = new Map();
    }

    createGame(challengerId, challengedId) {
        if (this.playerToGame.has(challengerId) || this.playerToGame.has(challengedId)) {
            return { error: 'One or both players are already in a game!' };
        }

        const game = new Game(challengerId, challengedId);
        this.games.set(game.id, game);
        this.playerToGame.set(challengerId, game.id);
        this.playerToGame.set(challengedId, game.id);

        return { success: true };
    }

    acceptGame(playerId) {
        const gameId = this.playerToGame.get(playerId);
        if (!gameId) {
            return { error: 'No pending game found!' };
        }

        const game = this.games.get(gameId);
        if (!game) {
            return { error: 'Game not found!' };
        }

        if (game.challengerId === playerId) {
            return { error: 'You cannot accept your own challenge!' };
        }

        game.start();
        return { success: true };
    }

    playCard(playerId, card) {
        const gameId = this.playerToGame.get(playerId);
        if (!gameId) {
            return { error: 'You are not in a game!' };
        }

        const game = this.games.get(gameId);
        if (!game) {
            return { error: 'Game not found!' };
        }

        const result = game.playCard(playerId, card);
        
        if (game.isComplete()) {
            // Cleanup
            this.playerToGame.delete(game.challengerId);
            this.playerToGame.delete(game.challengedId);
            this.games.delete(gameId);
            
            return {
                gameComplete: true,
                winner: game.getWinner(),
                cards: {
                    player1: game.player1Card,
                    player2: game.player2Card
                }
            };
        }

        return result;
    }
}

module.exports = { GameManager };
