const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
    new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Challenge another player to a game')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('The player you want to challenge')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display help information about the game'),
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display the top 5 players')
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
