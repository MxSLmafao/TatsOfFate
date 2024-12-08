class HelpCommand {
    constructor() {
        this.name = 'help';
    }

    async execute(message, args) {
        const helpMessage = `
**Three Card Game - Help** 🎮

This is a two-player card game with three cards:
• The Oppressed (👥) - The power of unity
• The Emperor (👑) - The symbol of authority
• The People (👪) - The voice of the masses

**Game Rules:**
• The Oppressed (👥) defeats The Emperor (👑)
• The Emperor (👑) defeats The People (👪)
• The People (👪) defeats The Oppressed (👥)

**Commands:**
• !play challenge @player - Challenge another player
• !play accept - Accept a challenge
• !play select <card> - Select your card (oppressed/emperor/people)
• !help - Show this help message

**How to Play:**
1. Challenge a player using !play challenge @player
2. The challenged player can accept or deny the challenge
3. The challenger can withdraw their challenge before it's accepted
4. Both players select their cards using !play select <card>
5. The winner is automatically determined based on the cards played

Good luck!
`;
        return message.channel.send(helpMessage);
    }
}

module.exports = { HelpCommand };
