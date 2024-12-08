const { CARDS, WINNING_COMBINATIONS } = require('../constants.js');
const { Pool } = require('pg');
const { Client } = require('discord.js');

class Game {
    constructor(challengerId, challengedId, discordClient) {
        this.id = Math.random().toString(36).substring(7);
        this.challengerId = challengerId;
        this.challengedId = challengedId;
        this.client = discordClient;
        this.player1Card = null;
        this.player2Card = null;
        this.started = false;
        this.currentRound = 1;
        this.maxRounds = 3;
        this.scores = {
            [challengerId]: 0,
            [challengedId]: 0
        };
        this.roundHistory = [];
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
                return { error: 'You have already played your card for this round!' };
            }
            this.player1Card = card;
        } else if (playerId === this.challengedId) {
            if (this.player2Card) {
                return { error: 'You have already played your card for this round!' };
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
            console.log(`Round ${this.currentRound} ended in a tie!`);
            return null; // Tie
        }

        const combination = `${this.player1Card}-${this.player2Card}`;
        const roundWinner = WINNING_COMBINATIONS[combination] === 1 ? this.challengerId : this.challengedId;
        
        // Update scores
        if (roundWinner) {
            this.scores[roundWinner]++;
        }

        // Store round history
        this.roundHistory.push({
            round: this.currentRound,
            player1Card: this.player1Card,
            player2Card: this.player2Card,
            winner: roundWinner
        });

        console.log(`Round ${this.currentRound} result: ${this.player1Card} vs ${this.player2Card}`);
        console.log(`Round ${this.currentRound} winner: ${roundWinner}`);

        // Reset cards for next round
        this.player1Card = null;
        this.player2Card = null;
        this.currentRound++;

        // Check if game is completely finished
        if (this.currentRound > this.maxRounds) {
            const finalWinner = this.getFinalWinner();
            return {
                roundWinner,
                gameComplete: true,
                finalWinner,
                scores: this.scores,
                history: this.roundHistory
            };
        }

        return {
            roundWinner,
            gameComplete: false,
            currentRound: this.currentRound,
            scores: this.scores
        };
    }

    async getFinalWinner() {
        if (this.scores[this.challengerId] === this.scores[this.challengedId]) {
            await this.updatePlayerStats(null);
            return null; // Game tied
        }
        
        const winnerId = this.scores[this.challengerId] > this.scores[this.challengedId] 
            ? this.challengerId 
            : this.challengedId;
        const loserId = winnerId === this.challengerId ? this.challengedId : this.challengerId;
        
        await this.updatePlayerStats(winnerId, loserId);
        return winnerId;
    }

    async updatePlayerStats(winnerId, loserId = null) {
        let pool = null;
        try {
            pool = new Pool({
                connectionString: process.env.DATABASE_URL
            });

            // Start transaction
            await pool.query('BEGIN');

            // Update or insert players
            const players = [this.challengerId, this.challengedId];
            for (const playerId of players) {
                const user = await this.client.users.fetch(playerId).catch(error => {
                    console.error(`Failed to fetch user ${playerId}:`, error);
                    throw new Error('Failed to fetch user information');
                });
                const avatarUrl = user.displayAvatarURL({ format: 'png', size: 128 });
                
                await pool.query(`
                    INSERT INTO players (discord_id, username, avatar_url, matches_played)
                    VALUES ($1, $2, $3, 1)
                    ON CONFLICT (discord_id) DO UPDATE SET
                        username = $2,
                        avatar_url = $3,
                        matches_played = players.matches_played + 1,
                        matches_won = CASE 
                            WHEN players.discord_id = $4 THEN players.matches_won + 1
                            ELSE players.matches_won
                        END,
                        last_updated = CURRENT_TIMESTAMP
                `, [
                    playerId,
                    user.username,
                    avatarUrl,
                    winnerId || null
                ]);
            }

            // Record match history if there's a winner
            if (winnerId && loserId) {
                await pool.query(`
                    INSERT INTO match_history (
                        match_id, winner_id, loser_id, winner_score, loser_score, played_at
                    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                `, [
                    this.id,
                    winnerId,
                    loserId,
                    this.scores[winnerId],
                    this.scores[loserId]
                ]);
            }

            await pool.query('COMMIT');
            console.log(`Successfully updated stats for game ${this.id}`);
        } catch (error) {
            if (pool) await pool.query('ROLLBACK');
            console.error('Error updating player stats:', error);
            throw new Error('Failed to update player statistics');
        } finally {
            if (pool) await pool.end();
        }
    }
}

module.exports = { Game };
