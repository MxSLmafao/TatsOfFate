const { Client, GatewayIntentBits, Collection, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { GameManager } = require('./game/GameManager.js');
const { CARDS } = require('./constants.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const gameManager = new GameManager(client);
const challengeTimeout = new Map(); // Store challenge timeouts

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'challenge') {
            const opponent = interaction.options.getUser('opponent');
            
            if (opponent.bot) {
                await interaction.reply({ content: '❌ You cannot challenge a bot!', ephemeral: true });
                return;
            }

            if (opponent.id === interaction.user.id) {
                await interaction.reply({ content: '❌ You cannot challenge yourself!', ephemeral: true });
                return;
            }

            const result = gameManager.createGame(interaction.user.id, opponent.id);
            if (result.error) {
                await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎮 New Challenge!')
                .setDescription(`${opponent.toString()}, you have been challenged by ${interaction.user.toString()}!`)
                .addFields(
                    { name: '🎲 Game', value: 'Three Card Game' },
                    { name: '⏳ Time Remaining', value: '2 hours' }
                )
                .setTimestamp();

            const acceptButton = new ButtonBuilder()
                .setCustomId(`accept_${interaction.user.id}_${opponent.id}`)
                .setLabel('Accept Challenge')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const denyButton = new ButtonBuilder()
                .setCustomId(`deny_${interaction.user.id}_${opponent.id}`)
                .setLabel('Deny Challenge')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const withdrawButton = new ButtonBuilder()
                .setCustomId(`withdraw_${interaction.user.id}_${opponent.id}`)
                .setLabel('Withdraw Challenge')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄');

            const row = new ActionRowBuilder().addComponents(acceptButton, denyButton, withdrawButton);

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            // Set timeout for 2 hours
            const timeout = setTimeout(async () => {
                try {
                    const expiredEmbed = EmbedBuilder.from(response.embeds[0])
                        .setColor('#ff0000')
                        .setTitle('❌ Challenge Expired')
                        .setFields(
                            { name: '🎲 Game', value: 'Three Card Game' },
                            { name: '📌 Status', value: 'Challenge has expired' }
                        );

                    await response.edit({
                        embeds: [expiredEmbed],
                        components: []
                    });
                    
                    gameManager.removeGame(interaction.user.id, opponent.id);
                    challengeTimeout.delete(`${interaction.user.id}_${opponent.id}`);
                } catch (error) {
                    console.error('Error handling challenge timeout:', error);
                }
            }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds

            challengeTimeout.set(`${interaction.user.id}_${opponent.id}`, timeout);
        } else if (interaction.commandName === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('Three Card Game - Help')
                .setDescription('A two-player card game with three cards representing different powers.')
                .addFields(
                    { name: '🎴 Cards', value: 
                        `• The Oppressed (${CARDS.oppressed}) - The power of unity\n` +
                        `• The Emperor (${CARDS.emperor}) - The symbol of authority\n` +
                        `• The People (${CARDS.people}) - The voice of the masses`
                    },
                    { name: '📋 Game Rules', value:
                        `• The Oppressed defeats The Emperor\n` +
                        `• The Emperor defeats The People\n` +
                        `• The People defeats The Oppressed`
                    },
                    { name: '🎮 How to Play', value:
                        '1. Use /challenge @player to challenge someone\n' +
                        '2. The challenged player has 2 hours to accept\n' +
                        '3. Once accepted, both players select their cards\n' +
                        '4. The winner is determined automatically'
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [helpEmbed] });
        }
    } else if (interaction.isButton()) {
        const [action, challengerId, challengedId] = interaction.customId.split('_');
        
        if (interaction.user.id !== challengedId) {
            await interaction.reply({ content: '❌ This button is not for you!', ephemeral: true });
            return;
        }

        if (action === 'accept') {
            const result = gameManager.acceptGame(interaction.user.id);
            if (result.error) {
                await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
                return;
            }

            // Clear the timeout
            const timeoutKey = `${challengerId}_${challengedId}`;
            clearTimeout(challengeTimeout.get(timeoutKey));
            challengeTimeout.delete(timeoutKey);

            const game = gameManager.getGame(result.gameId);
            const cardMenu = createCardSelectionMenu(challengerId, challengedId);

            if (!cardMenu) {
                await interaction.reply({ 
                    content: '❌ Error creating the game menu. Please try again.',
                    ephemeral: true 
                });
                return;
            }

            const startGameEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎮 Game Started!')
                .setDescription(`Round ${game.currentRound} - Players, select your cards!`)
                .addFields(
                    { name: '👥 Players', value: 
                        `Challenger: ${interaction.client.users.cache.get(challengerId)}\n` +
                        `Challenged: ${interaction.client.users.cache.get(challengedId)}`
                    },
                    { name: '📝 Available Cards', value:
                        `• The Oppressed ${CARDS.oppressed} - The power of unity\n` +
                        `• The Emperor ${CARDS.emperor} - The symbol of authority\n` +
                        `• The People ${CARDS.people} - The voice of the masses`
                    },
                    { name: '⏳ Time to Select', value: 'Make your selection!' }
                )
                .setTimestamp();

            // Update the channel message with game status and card selection
            await interaction.update({
                embeds: [startGameEmbed],
                components: [cardMenu]
            });
        } else if (action === 'deny' || action === 'withdraw') {
            // Verify user permissions for the action
            if (action === 'withdraw') {
                if (interaction.user.id !== challengerId) {
                    await interaction.reply({ 
                        content: '❌ Only the challenger can withdraw their challenge!', 
                        ephemeral: true 
                    });
                    return;
                }
            } else if (action === 'deny') {
                if (interaction.user.id !== challengedId) {
                    await interaction.reply({ 
                        content: '❌ Only the challenged player can deny the challenge!', 
                        ephemeral: true 
                    });
                    return;
                }
            }

            // Clear the timeout
            const timeoutKey = `${challengerId}_${challengedId}`;
            clearTimeout(challengeTimeout.get(timeoutKey));
            challengeTimeout.delete(timeoutKey);

            const actionText = action === 'deny' ? 'Denied' : 'Withdrawn';
            const statusText = action === 'deny' ? 
                `Challenge was denied by <@${challengedId}>` : 
                `Challenge was withdrawn by <@${challengerId}>`;

            const responseEmbed = new EmbedBuilder()
                .setTitle(`❌ Challenge ${actionText}`)
                .setColor('#ff0000')
                .addFields(
                    { name: '🎲 Game', value: 'Three Card Game' },
                    { name: '📌 Status', value: statusText }
                )
                .setTimestamp();

            await interaction.update({
                embeds: [responseEmbed],
                components: []
            });
            
            // Clean up the game state
            gameManager.removeGame(challengerId, challengedId);
            
            // Notify the other player
            const notifyUserId = action === 'deny' ? challengerId : challengedId;
            try {
                const user = await interaction.client.users.fetch(notifyUserId);
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`🎮 Challenge ${actionText}`)
                    .setColor('#ff0000')
                    .setDescription(statusText)
                    .setTimestamp();
                
                await user.send({
                    embeds: [dmEmbed]
                });
                console.log(`Notified ${action === 'deny' ? 'challenger' : 'challenged player'} about ${action}`);
            } catch (error) {
                console.error('Failed to notify user:', error);
                await interaction.followUp({
                    content: `⚠️ Couldn't notify <@${notifyUserId}> about the ${action}. They might have DMs disabled.`,
                    ephemeral: true
                });
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('card_select_')) {
            const [, , challengerId, challengedId] = interaction.customId.split('_');
            const playerId = interaction.user.id;
            
            if (playerId !== challengerId && playerId !== challengedId) {
                await interaction.reply({ content: '❌ This game is not for you!', ephemeral: true });
                return;
            }

            const result = gameManager.playCard(playerId, interaction.values[0]);
            if (result.error) {
                await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
                return;
            }

            await interaction.deferUpdate();

            if (result.waitingForOpponent) {
                await interaction.followUp({
                    content: '✅ Card selected! Waiting for opponent...',
                    ephemeral: true
                });
                return;
            }

            // Round complete
            const game = gameManager.getGame(result.gameId);
            const gameEmbed = createGameStatusEmbed(game, result);

            // If game is complete, send final results
            // Update the game status in the channel
            await interaction.message.edit({
                embeds: [gameEmbed],
                components: result.gameComplete ? [] : [createCardSelectionMenu(challengerId, challengedId)]
            });
        }
    }
});

function createCardSelectionMenu(challengerId, challengedId) {
    try {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`card_select_${challengerId}_${challengedId}`)
            .setPlaceholder('Choose your card')
            .addOptions([
                {
                    label: 'The Oppressed',
                    description: 'The power of unity',
                    value: 'oppressed',
                    emoji: CARDS.oppressed
                },
                {
                    label: 'The Emperor',
                    description: 'The symbol of authority',
                    value: 'emperor',
                    emoji: CARDS.emperor
                },
                {
                    label: 'The People',
                    description: 'The voice of the masses',
                    value: 'people',
                    emoji: CARDS.people
                }
            ]);

        return new ActionRowBuilder().addComponents(menu);
    } catch (error) {
        console.error('Error creating card selection menu:', error);
        return null;
    }
}

function createGameStatusEmbed(game, roundResult = null) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🎮 Three Card Game - Round ${game.currentRound}/${game.maxRounds}`)
        .addFields(
            { name: '📊 Scores', value: 
                `<@${game.challengerId}>: ${game.scores[game.challengerId]} 🏆\n` +
                `<@${game.challengedId}>: ${game.scores[game.challengedId]} 🏆`
            }
        );

    if (roundResult) {
        if (roundResult.gameComplete) {
            embed.setDescription('🏆 Game Complete!')
                .addFields(
                    { name: '👑 Final Winner', value: roundResult.finalWinner ? `<@${roundResult.finalWinner}>` : "🤝 It's a tie!" },
                    { name: '📈 Final Scores', value: 
                        `<@${game.challengerId}>: ${roundResult.scores[game.challengerId]} 🏆\n` +
                        `<@${game.challengedId}>: ${roundResult.scores[game.challengedId]} 🏆`
                    }
                );
        } else {
            embed.setDescription(`📝 Round ${game.currentRound - 1} Results:`)
                .addFields(
                    { name: '🎴 Cards Played', value:
                        `<@${game.challengerId}>: ${CARDS[roundResult.player1Card]}\n` +
                        `<@${game.challengedId}>: ${CARDS[roundResult.player2Card]}`
                    },
                    { name: '🏅 Round Winner', value: roundResult.roundWinner ? `<@${roundResult.roundWinner}>` : "🤝 It's a tie!" }
                );
        }
    }

    return embed;
}

client.login(process.env.DISCORD_TOKEN);
