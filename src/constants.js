const CARDS = {
    'oppressed': '👥',  // The Oppressed - symbol of unity
    'emperor': '👑',    // The Emperor - symbol of authority
    'people': '👪'      // The People - symbol of masses
};

// Game rules:
// - The Oppressed (👥) defeats The Emperor (👑)
// - The Emperor (👑) defeats The People (👪)
// - The People (👪) defeats The Oppressed (👥)
// 1 means player1 wins, -1 means player2 wins
const WINNING_COMBINATIONS = {
    'oppressed-emperor': 1,   // Oppressed defeats Emperor
    'emperor-oppressed': -1,  // Oppressed defeats Emperor
    'emperor-people': 1,      // Emperor defeats People
    'people-emperor': -1,     // Emperor defeats People
    'people-oppressed': 1,    // People defeats Oppressed
    'oppressed-people': -1    // People defeats Oppressed
};

module.exports = {
    CARDS,
    WINNING_COMBINATIONS
};
