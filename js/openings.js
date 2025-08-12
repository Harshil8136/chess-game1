// ===================================================================================
//  OPENINGS.JS
//  Contains a list of chess openings, sorted by PGN length for correct matching.
// ===================================================================================

const OPENINGS = [
    // Ply 1
    { pgn: "1. e4", name: "King's Pawn Opening" },
    { pgn: "1. d4", name: "Queen's Pawn Opening" },
    { pgn: "1. c4", name: "English Opening" },
    { pgn: "1. Nf3", name: "Réti Opening" },
    { pgn: "1. f4", name: "Bird's Opening" },
    { pgn: "1. b3", name: "Larsen's Opening" },
    { pgn: "1. g3", name: "King's Fianchetto Opening" },
    // Ply 2
    { pgn: "1. e4 c5", name: "Sicilian Defense" },
    { pgn: "1. e4 c6", name: "Caro-Kann Defense" },
    { pgn: "1. e4 d5", name: "Scandinavian Defense" },
    { pgn: "1. e4 d6", name: "Pirc Defense" },
    { pgn: "1. e4 e5", name: "King's Pawn Game" },
    { pgn: "1. e4 e6", name: "French Defense" },
    { pgn: "1. e4 g6", name: "Modern Defense" },
    { pgn: "1. e4 Nf6", name: "Alekhine's Defense" },
    { pgn: "1. d4 d5", name: "Queen's Pawn Game" },
    { pgn: "1. d4 e5", name: "Englund Gambit" },
    { pgn: "1. d4 f5", name: "Dutch Defense" },
    { pgn: "1. d4 Nf6", name: "Indian Defense" },
    { pgn: "1. c4 e5", name: "English Opening: King's English Variation" },
    { pgn: "1. c4 Nf6", name: "English Opening: Anglo-Indian Defense" },
    { pgn: "1. Nf3 d5", name: "Réti Opening: Main Line" },
    // Ply 3
    { pgn: "1. e4 e5 2. f4", name: "King's Gambit" },
    { pgn: "1. e4 e5 2. Nf3", name: "King's Knight Opening" },
    { pgn: "1. d4 d5 2. c4", name: "Queen's Gambit" },
    { pgn: "1. d4 Nf6 2. c4", name: "Indian Game" },
    // Ply 4
    { pgn: "1. e4 e5 2. Nf3 d6", name: "Philidor Defense" },
    { pgn: "1. e4 e5 2. Nf3 Nc6", name: "Open Game" },
    { pgn: "1. e4 e5 2. Nf3 Nf6", name: "Petrov's Defense" },
    { pgn: "1. d4 d5 2. c4 c6", name: "Slav Defense" },
    { pgn: "1. d4 d5 2. c4 e6", name: "Queen's Gambit Declined (QGD)" },
    { pgn: "1. d4 d5 2. c4 dxc4", name: "Queen's Gambit Accepted (QGA)" },
    // Ply 5
    { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5", name: "Ruy López" },
    { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4", name: "Italian Game" },
    { pgn: "1. e4 e5 2. Nf3 Nc6 3. d4", name: "Scotch Game" },
    { pgn: "1. d4 Nf6 2. c4 e6 3. Nf3 b6", name: "Queen's Indian Defense" },
    { pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4", name: "Nimzo-Indian Defense" },
    { pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 d5", name: "Grünfeld Defense" },
    { pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7", name: "King's Indian Defense (KID)" },
    // Ply 6
    { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5", name: "Giuoco Piano" },
    { pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6", name: "Two Knights Defense" },
    // Ply 8
    { pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4", name: "Slav Defense: Accepted" },
    // Ply 9
    { pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5", name: "QGD: Exchange Variation" },
    // Ply 10
    { pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6", name: "Sicilian Defense: Dragon Variation" },
    { pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6", name: "Sicilian Defense: Najdorf Variation" },
    { pgn: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5", name: "Sicilian Defense: Sveshnikov Variation" },
    { pgn: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6", name: "Sicilian Defense: Scheveningen Variation" },
];