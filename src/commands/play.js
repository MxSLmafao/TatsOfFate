const { GameManager } = require('../game/GameManager.js');
const { CARDS } = require('../constants.js');

class PlayCommand {
    constructor() {
        this.name = 'play';
        this.gameManager = new GameManager();
    }

    async execute(message, args) {
        const subCommand = args[0]?.toLowerCase();
        
        switch (subCommand) {
            case 'challenge':
                return this.challengePlayer(message);
            case 'accept':
                return this.acceptChallenge(message);
            case 'select':
                return this.selectCard(message, args[1]);
            default:
                return message.reply('Available commands: !play challenge, !play accept, !play select <card>');
        }
    }

    async challengePlayer(message) {
        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
            return message.reply('Please mention a player to challenge. Example: !play challenge @player');
        }

        if (mentionedUser.bot) {
            return message.reply('You cannot challenge a bot!');
        }

        const result = this.gameManager.createGame(message.author.id, mentionedUser.id);
        if (result.error) {
            return message.reply(result.error);
        }

        return message.channel.send(
            `🎯 **New Challenge!**\n` +
            `${mentionedUser.toString()}, you have been challenged by ${message.author.toString()}!\n` +
            '➡️ Use "!play accept" to accept the challenge.'
        );
    }

    async acceptChallenge(message) {
        const result = this.gameManager.acceptGame(message.author.id);
        if (result.error) {
            return message.reply(result.error);
        }

        return message.channel.send(
            '🎮 **Game Started!**\n' +
            'Use "!play select <card>" to choose your card:\n' +
            `- oppressed ${CARDS.oppressed}\n` +
            `- emperor ${CARDS.emperor}\n` +
            `- people ${CARDS.people}`
        );
    }

    async selectCard(message, cardName) {
        if (!cardName || !CARDS[cardName.toLowerCase()]) {
            return message.reply('Invalid card. Choose: oppressed, emperor, or people');
        }

        const result = this.gameManager.playCard(message.author.id, cardName.toLowerCase());
        if (result.error) {
            return message.reply(result.error);
        }

        if (result.gameComplete) {
            const winner = result.winner ? `<@${result.winner}>` : "It's a tie!";
            const cards = result.cards;
            
            return message.channel.send(
                `🎮 **Game Over!**\n` +
                `Player 1 played: ${cards.player1} ${CARDS[cards.player1]}\n` +
                `Player 2 played: ${cards.player2} ${CARDS[cards.player2]}\n` +
                `🏆 Winner: ${winner}`
            );
        }

        return message.reply('Card selected! Waiting for other player...');
    }
}

module.exports = { PlayCommand };
