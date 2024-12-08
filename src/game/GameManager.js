const { Game } = require('./Game.js');

class GameManager {
    constructor(discordClient) {
        this.games = new Map();
        this.playerToGame = new Map();
        this.client = discordClient;
    }

    createGame(challengerId, challengedId) {
        if (this.playerToGame.has(challengerId) || this.playerToGame.has(challengedId)) {
            return { error: 'One or both players are already in a game!' };
        }

        const game = new Game(challengerId, challengedId, this.client);
        this.games.set(game.id, game);
        this.playerToGame.set(challengerId, game.id);
        this.playerToGame.set(challengedId, game.id);

        return { success: true, gameId: game.id };
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
        return { success: true, gameId: game.id };
    }

    removeGame(challengerId, challengedId) {
        const challengerGameId = this.playerToGame.get(challengerId);
        if (challengerGameId) {
            this.games.delete(challengerGameId);
            this.playerToGame.delete(challengerId);
            this.playerToGame.delete(challengedId);
        }
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

        if (!game.started) {
            return { error: 'Game has not started yet!' };
        }

        const result = game.playCard(playerId, card);
        if (result.error) {
            return result;
        }
        
        if (game.isComplete()) {
            const roundResult = game.getWinner();
            
            if (roundResult.gameComplete) {
                // Final round completed, clean up the game
                this.playerToGame.delete(game.challengerId);
                this.playerToGame.delete(game.challengedId);
                this.games.delete(gameId);
            }
            
            return roundResult;
        }

        return {
            success: true,
            currentRound: game.currentRound,
            waitingForOpponent: true
        };
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }
}

module.exports = { GameManager };
