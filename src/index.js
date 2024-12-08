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

            const withdrawButton = new ButtonBuilder()
                .setCustomId(`withdraw_${interaction.user.id}_${opponent.id}`)
                .setLabel('Withdraw Challenge')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔄');

            const row = new ActionRowBuilder().addComponents(withdrawButton);

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
            if (!game) {
                await interaction.reply({ 
                    content: '❌ Error retrieving the game. Please try again.',
                    ephemeral: true 
                });
                return;
            }

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
                .setDescription(`Round ${game.currentRound} of ${game.maxRounds} - Choose Your Cards!`)
                .addFields(
                    { name: '👥 Players', value: 
                        `Challenger: <@${challengerId}>\n` +
                        `Challenged: <@${challengedId}>`
                    },
                    { name: '📝 Available Cards', value:
                        `• The Oppressed ${CARDS.oppressed} - The power of unity\n` +
                        `• The Emperor ${CARDS.emperor} - The symbol of authority\n` +
                        `• The People ${CARDS.people} - The voice of the masses`
                    },
                    { name: '⚔️ Current Round', value: `Round ${game.currentRound}` },
                    { name: '📊 Scores', value: 
                        `<@${challengerId}>: ${game.scores[challengerId]} 🏆\n` +
                        `<@${challengedId}>: ${game.scores[challengedId]} 🏆`
                    }
                )
                .setTimestamp();

            try {
                // Update the channel message with game status and card selection
                await interaction.update({
                    embeds: [startGameEmbed],
                    components: [cardMenu]
                });

                // Send a private confirmation message
                await interaction.followUp({
                    content: '✅ Game started! Select your card from the menu above.',
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error updating game status:', error);
                await interaction.followUp({
                    content: '❌ There was an error starting the game. Please try again.',
                    ephemeral: true
                });
            }
        } else if (action === 'withdraw') {
            // Verify if the user is the challenger
            if (interaction.user.id !== challengerId) {
                await interaction.reply({
                    content: '❌ Only the challenger can withdraw their challenge!',
                    ephemeral: true
                });
                return;
            }

            // Clear the timeout
            const timeoutKey = `${challengerId}_${challengedId}`;
            clearTimeout(challengeTimeout.get(timeoutKey));
            challengeTimeout.delete(timeoutKey);

            // Clean up the game state
            gameManager.removeGame(challengerId, challengedId);

            // Create response embed for withdrawal
            const withdrawEmbed = new EmbedBuilder()
                .setTitle('❌ Challenge Withdrawn')
                .setColor('#ff0000')
                .addFields(
                    { name: '🎲 Game', value: 'Three Card Game' },
                    { name: '📌 Status', value: `Challenge was withdrawn by <@${challengerId}>` }
                )
                .setTimestamp();

            // Update the original message
            await interaction.update({
                embeds: [withdrawEmbed],
                components: []
            });

            // Notify the challenged player
            await interaction.followUp({
                content: `<@${challengedId}>, the challenge has been withdrawn.`
            });
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

            const game = gameManager.getGame(result.gameId);
            if (result.waitingForOpponent) {
                const waitingEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎮 Three Card Game - Waiting')
                    .setDescription(`Round ${game.currentRound} of ${game.maxRounds} - Waiting for opponent...`)
                    .addFields(
                        { name: '👥 Players', value: 
                            `Challenger: <@${challengerId}>\n` +
                            `Challenged: <@${challengedId}>`
                        },
                        { name: '🎮 Status', value: `<@${playerId}> has selected their card. Waiting for the other player...` },
                        { name: '📊 Scores', value: 
                            `<@${challengerId}>: ${game.scores[challengerId]} 🏆\n` +
                            `<@${challengedId}>: ${game.scores[challengedId]} 🏆`
                        }
                    )
                    .setTimestamp();

                await interaction.update({
                    embeds: [waitingEmbed],
                    components: [createCardSelectionMenu(challengerId, challengedId)]
                });

                await interaction.followUp({
                    content: '✅ Your card has been selected! Waiting for your opponent to choose...',
                    ephemeral: true
                });
                return;
            }

            // Round complete
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
            .setPlaceholder('Choose your card for this round')
            .addOptions([
                {
                    label: 'The Oppressed',
                    description: 'Defeats The Emperor (Power of Unity)',
                    value: 'oppressed',
                    emoji: CARDS.oppressed
                },
                {
                    label: 'The Emperor',
                    description: 'Defeats The People (Symbol of Authority)',
                    value: 'emperor',
                    emoji: CARDS.emperor
                },
                {
                    label: 'The People',
                    description: 'Defeats The Oppressed (Voice of Masses)',
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
            { name: '👥 Players', value: 
                `Challenger: <@${game.challengerId}>\n` +
                `Challenged: <@${game.challengedId}>`
            },
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
