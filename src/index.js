const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { PlayCommand } = require('./commands/play.js');
const { HelpCommand } = require('./commands/help.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();

// Register commands
const playCommand = new PlayCommand();
const helpCommand = new HelpCommand();

client.commands.set(playCommand.name, playCommand);
client.commands.set(helpCommand.name, helpCommand);

const prefix = '!';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error executing that command!');
    }
});

// Replace 'YOUR_BOT_TOKEN' with the actual bot token from Discord Developer Portal
client.login(process.env.DISCORD_TOKEN);
