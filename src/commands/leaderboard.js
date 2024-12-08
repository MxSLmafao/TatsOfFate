const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

class LeaderboardCommand {
    constructor() {
        this.name = 'leaderboard';
    }

    async execute(interaction) {
        try {
            // Get top 5 players
            const result = await pool.query(`
                SELECT 
                    discord_id,
                    username,
                    avatar_url,
                    matches_won,
                    matches_played,
                    CASE 
                        WHEN matches_played > 0 
                        THEN ROUND((matches_won::float / matches_played::float) * 100, 1)
                        ELSE 0
                    END as win_rate
                FROM players 
                WHERE matches_played > 0
                ORDER BY matches_won DESC, win_rate DESC 
                LIMIT 5
            `);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏆 Three Card Game - Top Players')
                .setDescription('Top 5 players by matches won')
                .setTimestamp();

            if (result.rows.length === 0) {
                embed.setDescription('No matches played yet! Be the first to play!');
            } else {
                result.rows.forEach((player, index) => {
                    embed.addFields({
                        name: `${index + 1}. ${player.username}`,
                        value: `Wins: ${player.matches_won} | Games: ${player.matches_played} | Win Rate: ${player.win_rate}%`,
                        inline: false
                    });
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.reply({ 
                content: 'Sorry, there was an error fetching the leaderboard!',
                ephemeral: true 
            });
        }
    }
}

module.exports = { LeaderboardCommand };
