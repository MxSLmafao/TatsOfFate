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
            // Get top 5 players with detailed statistics
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
                .setColor('#FFD700')  // Gold color for the leaderboard
                .setTitle('🏆 Three Card Game - Leaderboard')
                .setDescription('Top Players by Victories')
                .setTimestamp()
                .setFooter({ text: 'Updated' });

            if (result.rows.length === 0) {
                embed.setDescription('🎮 No matches played yet! Challenge someone to be the first on the leaderboard!');
            } else {
                // Add medal emojis for top 3
                const medals = ['🥇', '🥈', '🥉'];
                
                result.rows.forEach((player, index) => {
                    const medal = index < 3 ? medals[index] : '👤';
                    const rankText = `${medal} Rank #${index + 1}`;
                    
                    embed.addFields({
                        name: rankText,
                        value: `**${player.username}**\n` +
                              `📊 Stats:\n` +
                              `• Victories: ${player.matches_won} 🏆\n` +
                              `• Total Games: ${player.matches_played} 🎮\n` +
                              `• Win Rate: ${player.win_rate}% ✨`,
                        inline: false
                    });

                    // Set thumbnail to the top player's avatar
                    if (index === 0 && player.avatar_url) {
                        embed.setThumbnail(player.avatar_url);
                    }
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.reply({ 
                content: '❌ Sorry, there was an error fetching the leaderboard! Please try again later.',
                ephemeral: true 
            });
        }
    }
}

module.exports = { LeaderboardCommand };
