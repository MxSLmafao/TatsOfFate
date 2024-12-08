const { CARDS, WINNING_COMBINATIONS } = require('../constants.js');

class Game {
    constructor(challengerId, challengedId) {
        this.id = Math.random().toString(36).substring(7);
        this.challengerId = challengerId;
        this.challengedId = challengedId;
        this.player1Card = null;
        this.player2Card = null;
        this.started = false;
    }

    start() {
        this.started = true;
    }

    playCard(playerId, card) {
        if (!this.started) {
            return { error: 'Game has not started yet!' };
        }

        if (!CARDS[card]) {
            return { error: 'Invalid card selection!' };
        }

        if (playerId === this.challengerId) {
            if (this.player1Card) {
                return { error: 'You have already played your card!' };
            }
            this.player1Card = card;
        } else if (playerId === this.challengedId) {
            if (this.player2Card) {
                return { error: 'You have already played your card!' };
            }
            this.player2Card = card;
        } else {
            return { error: 'You are not part of this game!' };
        }

        return { success: true };
    }

    isComplete() {
        return this.player1Card && this.player2Card;
    }

    getWinner() {
        if (!this.isComplete()) {
            return null;
        }

        if (this.player1Card === this.player2Card) {
            console.log('Game ended in a tie!');
            return null; // Tie
        }

        const combination = `${this.player1Card}-${this.player2Card}`;
        console.log(`Game result: ${this.player1Card} vs ${this.player2Card}`);
        console.log(`Combination: ${combination}, Result: ${WINNING_COMBINATIONS[combination]}`);
        return WINNING_COMBINATIONS[combination] === 1 ? this.challengerId : this.challengedId;
    }
}

module.exports = { Game };
