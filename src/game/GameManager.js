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
            waitingForOpponent: true,
            gameId: gameId
        };
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    withdrawChallenge(challengerId) {
        try {
            console.log(`Attempting to withdraw challenge for challenger: ${challengerId}`);
            
            // Verify there's a pending challenge
            const gameId = this.playerToGame.get(challengerId);
            if (!gameId) {
                console.log(`No pending challenge found for challenger: ${challengerId}`);
                return { error: 'No pending challenge found!' };
            }

            // Verify game exists
            const game = this.games.get(gameId);
            if (!game) {
                console.log(`Game not found for ID: ${gameId}, cleaning up mappings`);
                // Clean up any lingering player-to-game mappings
                this.playerToGame.delete(challengerId);
                return { error: 'Game not found!' };
            }

            // Verify the user is the challenger
            if (game.challengerId !== challengerId) {
                console.log(`User ${challengerId} attempted to withdraw challenge they didn't create`);
                return { error: 'Only the challenger can withdraw their challenge!' };
            }

            // Verify the game hasn't started
            if (game.started) {
                console.log(`Cannot withdraw game ${gameId} - game has already started`);
                return { error: 'Cannot withdraw after the game has started!' };
            }

            // Store player IDs before cleanup
            const challengedId = game.challengedId;

            // Clean up the game state
            console.log(`Cleaning up game state for game ${gameId}`);
            console.log(`- Removing player mapping for challenger: ${challengerId}`);
            this.playerToGame.delete(game.challengerId);
            console.log(`- Removing player mapping for challenged: ${challengedId}`);
            this.playerToGame.delete(game.challengedId);
            console.log(`- Removing game from games collection`);
            this.games.delete(gameId);

            console.log(`Challenge withdrawn successfully - Game ID: ${gameId}, Challenger: ${challengerId}, Challenged: ${challengedId}`);

            return { 
                success: true, 
                message: 'Challenge successfully withdrawn!',
                challengerId: challengerId,
                challengedId: challengedId,
                gameId: gameId
            };
        } catch (error) {
            console.error('Error in withdrawChallenge:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            return { error: 'An error occurred while withdrawing the challenge. Please try again.' };
        }
    }
}

module.exports = { GameManager };
