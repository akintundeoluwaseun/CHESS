import type { Square } from '@/chess/types';
import { START_FEN } from '@/chess/types';

/**
 * Lesson content. Every position and move here is checked by
 * `npm run build:content` (scripts/validate-content.ts): positions must be
 * legal, solutions must be legal, and moves marked as "best" are confirmed by
 * Stockfish so we never teach a bad move.
 */
export type LessonStep =
  | { kind: 'info'; title: string; text: string; fen?: string; highlights?: Square[] }
  | {
      kind: 'move';
      title: string;
      text: string;
      fen: string;
      /** Plies starting with the learner: "e2e4|d2d4" lists alternatives; odd indices are scripted replies. */
      solution: string[];
      success: string;
      hint: string;
      /** false for pure rules drills where engine-best play is not the point. */
      verify?: boolean;
    }
  | {
      kind: 'goal';
      title: string;
      text: string;
      fen: string;
      goal: 'mate' | 'promote';
      maxMoves: number;
      success: string;
    };

export interface Lesson {
  id: string;
  category: string;
  title: string;
  summary: string;
  steps: LessonStep[];
}

export const LESSON_CATEGORIES = [
  { id: 'basics', title: 'The Basics' },
  { id: 'openings', title: 'Opening Principles' },
  { id: 'tactics', title: 'Tactics' },
  { id: 'mates', title: 'Checkmate Patterns' },
  { id: 'endgames', title: 'Endgames' },
];

export const LESSONS: Lesson[] = [
  {
    id: 'pieces', category: 'basics', title: 'How the Pieces Move', summary: 'Rook, bishop, knight, queen and king.',
    steps: [
      { kind: 'info', title: 'The board', fen: START_FEN,
        text: 'Chess is played on an 8×8 board. Each side has 16 pieces. White always moves first, then the players take turns. The goal is checkmate: attacking the enemy king so that it cannot escape.' },
      { kind: 'move', title: 'The rook', fen: '7k/p7/8/8/8/8/8/R3K3 w - - 0 1', solution: ['a1a7'], verify: false,
        text: 'Rooks move any number of squares in a straight line — up, down, left or right. Capture the pawn on a7 with your rook.',
        hint: 'Slide the rook straight up the a-file.', success: 'Rooks are strongest on open lines with nothing in the way.' },
      { kind: 'move', title: 'The bishop', fen: '7k/8/5n2/8/8/8/8/B3K3 w - - 0 1', solution: ['a1f6'], verify: false,
        text: 'Bishops move diagonally, any distance. A bishop always stays on squares of one colour. Capture the knight.',
        hint: 'Follow the long diagonal from a1.', success: 'Long diagonals give bishops enormous reach.' },
      { kind: 'move', title: 'The knight', fen: '4k3/8/8/8/8/5q2/5P1P/4K1N1 w - - 0 1', solution: ['g1f3'], verify: false,
        text: 'Knights move in an "L": two squares one way, then one square sideways. They are the only piece that can jump over others. Capture the queen!',
        hint: 'From g1, an L-shape reaches f3.', success: 'Winning a queen with a knight is a great trade — a queen is worth about three knights.' },
      { kind: 'move', title: 'The queen', fen: 'r5k1/8/8/8/8/8/8/Q3K3 w - - 0 1', solution: ['a1a8'], verify: false,
        text: 'The queen combines the rook and bishop: straight lines and diagonals. She is your most powerful piece. Capture the rook.',
        hint: 'The a-file is open all the way to a8.', success: 'And it comes with check — the king is attacked along the 8th rank.' },
      { kind: 'move', title: 'The king', fen: '8/8/8/8/8/3p4/4K3/7k w - - 0 1', solution: ['e2d3'], verify: false,
        text: 'The king moves one square in any direction. The black pawn is attacking your king — that is called check. Capture the pawn with your king.',
        hint: 'The pawn on d3 is right next to your king and nothing protects it.', success: 'A king may capture any piece that is not protected.' },
    ],
  },
  {
    id: 'pawns', category: 'basics', title: 'Pawns & Promotion', summary: 'Pawn moves, captures, en passant and promotion.',
    steps: [
      { kind: 'info', title: 'Pawn rules', fen: START_FEN,
        text: 'Pawns move straight forward one square — or two squares on their very first move. Unlike every other piece, they capture differently from how they move: one square diagonally forward.' },
      { kind: 'move', title: 'Capturing', fen: '4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', solution: ['e4d5'], verify: false,
        text: 'Your pawn on e4 can capture diagonally. Take the knight.', hint: 'Pawns capture one square diagonally forward.',
        success: 'A pawn (worth 1) captured a knight (worth 3). Always watch for pawn captures.' },
      { kind: 'move', title: 'Promotion', fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', solution: ['b7b8q'], verify: false,
        text: 'A pawn that reaches the far side of the board promotes — it becomes a queen, rook, bishop or knight. Push the pawn and choose a queen.',
        hint: 'Move the pawn to b8 and pick the queen.', success: 'A brand-new queen — and it gives check right away.' },
      { kind: 'move', title: 'En passant', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', solution: ['e5d6'], verify: false,
        text: 'Black just moved a pawn two squares, from d7 to d5, landing beside your pawn. For one move only, you may capture it as if it had moved one square. This is "en passant". Capture it!',
        hint: 'Your pawn moves diagonally to d6 and the d5 pawn is removed.', success: 'En passant must be played immediately or the chance is gone.' },
      { kind: 'goal', title: 'Promote against a defender', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', goal: 'promote', maxMoves: 15,
        text: 'Now do it for real. The engine will defend with its king. Escort your pawn to the last rank and promote. Tip: your king in front of the pawn is the key.',
        success: 'With your king leading the way, the pawn could not be stopped.' },
    ],
  },
  {
    id: 'check', category: 'basics', title: 'Check & Checkmate', summary: 'Escaping check, and delivering mate.',
    steps: [
      { kind: 'info', title: 'Three ways out of check',
        text: 'When your king is attacked you must deal with it immediately. You have three options: move the king to a safe square, block the attack with a piece, or capture the attacking piece. If none of these works, it is checkmate and the game is over.' },
      { kind: 'move', title: 'Capture the attacker', fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', solution: ['e1d2'],
        text: 'The black queen is giving check, but nothing protects her. Capture her with your king.',
        hint: 'The queen on d2 is next to your king.', success: 'An unprotected checking piece can simply be taken.' },
      { kind: 'move', title: 'Block the check', fen: 'k3r3/8/8/8/8/8/3B1P2/4K3 w - - 0 1', solution: ['d2e3'], verify: false,
        text: 'The rook on e8 is checking your king down the e-file. Block it with your bishop on a square your pawn protects.',
        hint: 'Put the bishop on e3 — the f2 pawn guards it.', success: 'Blocking with a protected piece keeps your material safe.' },
      { kind: 'move', title: 'Checkmate', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution: ['d1d8'],
        text: 'The black king is trapped behind its own pawns. Deliver checkmate in one move.',
        hint: 'Your rook can reach the 8th rank.', success: 'Checkmate! The king is attacked and has no escape square.' },
      { kind: 'move', title: 'Queen and king', fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', solution: ['h2h8'],
        text: 'Your king guards a7 and b7. Find the queen move that checkmates.',
        hint: 'Check along the 8th rank.', success: 'Working together, king and queen covered every escape.' },
    ],
  },
  {
    id: 'castling', category: 'basics', title: 'Castling', summary: 'The special king-and-rook move.',
    steps: [
      { kind: 'info', title: 'What is castling?',
        text: 'Castling moves the king two squares toward a rook, and the rook jumps to the other side of the king. It is allowed only if neither piece has moved, the squares between them are empty, and the king is not in check, does not pass through check, and does not land in check.' },
      { kind: 'move', title: 'Castle kingside', fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1', solution: ['e1g1'], verify: false,
        text: 'Castle on the kingside (short castling). Move your king two squares to the right.',
        hint: 'Drag the king from e1 to g1.', success: 'Your king is tucked behind pawns and your rook has come to f1.' },
      { kind: 'move', title: 'Castle queenside', fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1', solution: ['e1c1'], verify: false,
        text: 'Now castle on the queenside (long castling): the king goes two squares to the left.',
        hint: 'King from e1 to c1.', success: 'Long castling puts your rook straight onto the d-file.' },
      { kind: 'info', title: 'Castle early',
        text: 'A king in the centre is easy to attack once lines open. Castling early, usually within the first ten moves, makes your king safe and brings a rook into the game.' },
    ],
  },
  {
    id: 'draws', category: 'basics', title: 'Stalemate & Draws', summary: 'How games end without a winner.',
    steps: [
      { kind: 'info', title: 'Ways to draw',
        text: 'A game is drawn by stalemate (the side to move has no legal move but is not in check), threefold repetition of a position, the 50-move rule (no capture or pawn move for 50 moves each), insufficient material (for example king against king), or agreement.' },
      { kind: 'move', title: 'Avoid stalemate', fen: 'k7/2K5/8/8/8/8/8/1Q6 w - - 0 1', solution: ['b1b7|b1a1|b1a2'],
        text: 'You are completely winning, but careful: Qb6 would leave Black with no legal moves and no check — stalemate, a draw. Find a checkmate instead.',
        hint: 'Give check on the a-file, or on b7 where your king protects the queen.', success: 'Always check that your opponent has a legal move unless you are giving mate.' },
    ],
  },
  {
    id: 'centre', category: 'openings', title: 'Control the Centre', summary: 'Why the four central squares matter.',
    steps: [
      { kind: 'info', title: 'The centre', fen: START_FEN, highlights: ['d4', 'e4', 'd5', 'e5'],
        text: 'The four squares in the middle — d4, e4, d5 and e5 — are the most important on the board. Pieces in the centre reach more squares, and controlling the centre makes it harder for your opponent to coordinate.' },
      { kind: 'move', title: 'A strong first move', fen: START_FEN, solution: ['e2e4|d2d4'],
        text: 'Start the game by placing a pawn in the centre.',
        hint: 'Move the e-pawn or the d-pawn two squares.', success: 'This pawn controls central squares and opens lines for your bishop and queen.' },
      { kind: 'move', title: 'Attack the centre', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', solution: ['g1f3'],
        text: 'Black replied 1...e5. Develop a knight toward the centre, attacking the black pawn.',
        hint: 'The g1-knight can jump to f3.', success: 'The knight develops with a threat — efficient moves like this gain time.' },
      { kind: 'move', title: 'Take the whole centre', fen: 'rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', solution: ['d2d4'],
        text: 'Black played 1...b6 and left the centre to you. Build a strong pawn centre.',
        hint: 'Put a second pawn beside your e-pawn.', success: 'Two pawns side by side in the centre are a powerful duo.' },
    ],
  },
  {
    id: 'develop', category: 'openings', title: 'Develop Your Pieces', summary: 'Get pieces out quickly and safely.',
    steps: [
      { kind: 'info', title: 'Development',
        text: 'In the opening, bring your knights and bishops into play quickly, aiming them at the centre. Try not to move the same piece twice, and do not bring the queen out early, where enemy pieces can chase it while they develop.' },
      { kind: 'move', title: 'Active bishop', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', solution: ['f1c4|f1b5'],
        text: 'Develop your light-squared bishop to an active diagonal.',
        hint: 'c4 aims at f7; b5 pressures the knight defending e5.', success: 'The bishop is in play and your king is one step closer to castling.' },
      { kind: 'move', title: 'Keep developing', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', solution: ['b1c3|e1g1|c2c3|d2d3'],
        text: 'Both sides have developed two pieces. Make another useful developing move — or castle.',
        hint: 'Castling, Nc3, c3 or d3 are all good here.', success: 'Good. Every piece that joins the game makes your position stronger.' },
    ],
  },
  {
    id: 'traps', category: 'openings', title: 'Early Traps', summary: "Avoid Scholar's mate and punish weak moves.",
    steps: [
      { kind: 'move', title: "Stop Scholar's mate", fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2', solution: ['b8c6', 'f1c4', 'g7g6|d8e7|d8f6'],
        text: 'You are Black. White brought the queen out early and attacks your e5 pawn. Defend it with a developing move.',
        hint: 'A knight can protect e5.', success: 'Well defended. White aimed at f7, and you shut the queen out of the attack.' },
      { kind: 'move', title: "Fool's mate", fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', solution: ['d8h4'],
        text: 'White weakened the squares around the king by pushing the f- and g-pawns. Deliver checkmate!',
        hint: 'Your queen can reach the e1–h4 diagonal.', success: 'The fastest checkmate in chess. Be careful with the pawns in front of your king.' },
    ],
  },
  {
    id: 'forks', category: 'tactics', title: 'Forks', summary: 'One piece attacking two.',
    steps: [
      { kind: 'info', title: 'What is a fork?',
        text: 'A fork is a single move that attacks two or more enemy pieces at once. Your opponent can usually save only one of them. Knights are famous for forks, but any piece — even a pawn — can fork.' },
      { kind: 'move', title: 'Royal fork', fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', solution: ['b5c7'],
        text: 'Find the knight move that attacks the king and the queen at the same time.',
        hint: 'From c7 a knight reaches both a8 and e8.', success: 'Check! The king must move, and the queen falls next move.' },
      { kind: 'move', title: 'Pawn fork', fen: 'k7/8/8/2n1b3/8/2PP4/8/4K3 w - - 0 1', solution: ['d3d4'],
        text: 'A humble pawn can attack two pieces. Find it.',
        hint: 'A pawn on d4 would attack c5 and e5 — and c3 protects it.', success: 'Black cannot save both pieces. Pawn forks are easy to miss!' },
    ],
  },
  {
    id: 'pins', category: 'tactics', title: 'Pins', summary: 'Freezing a piece in front of a bigger one.',
    steps: [
      { kind: 'info', title: 'What is a pin?',
        text: 'A pin is an attack on a piece that cannot move without exposing a more valuable piece behind it. If the piece behind is the king, the pinned piece is not allowed to move at all.' },
      { kind: 'move', title: 'Pin the queen', fen: '4k3/8/8/4q3/8/8/5K2/R7 w - - 0 1', solution: ['a1e1'],
        text: 'Line up your rook with the black queen and king.',
        hint: 'Put the rook on the e-file.', success: 'The queen is pinned to her king. Black can only take the rook, and then your king takes back — you win the queen for a rook.' },
      { kind: 'move', title: 'Use the pin', fen: '4k3/8/8/8/1b4n1/8/3Q4/4K3 w - - 0 1', solution: ['d2b4'],
        text: 'Your queen is pinned by the bishop — it cannot leave the diagonal. But a pinned piece can still move along the pin line. Win material!',
        hint: 'Capture the piece that is pinning you.', success: 'Capturing along the pin line is always allowed.' },
    ],
  },
  {
    id: 'skewers', category: 'tactics', title: 'Skewers', summary: 'Attack the big piece; win the one behind.',
    steps: [
      { kind: 'info', title: 'What is a skewer?',
        text: 'A skewer is like a reversed pin: you attack a valuable piece, and when it moves out of the way, you capture the piece behind it.' },
      { kind: 'move', title: 'Rook skewer', fen: '8/8/2k4q/8/8/8/8/R5K1 w - - 0 1', solution: ['a1a6', 'c6b7', 'a6h6'],
        text: 'The black king and queen are on the same rank. Skewer them.',
        hint: 'Check the king along the 6th rank.', success: 'The king had to step aside and the queen was lost.' },
    ],
  },
  {
    id: 'discovered', category: 'tactics', title: 'Discovered Attacks', summary: 'Move one piece to unleash another.',
    steps: [
      { kind: 'info', title: 'Discovered attacks',
        text: 'When one piece moves out of the way, it can uncover an attack by a piece behind it. If the uncovered attack is a check, it is called a discovered check — and the piece that moved can do almost anything it likes.' },
      { kind: 'move', title: 'Discovered check', fen: 'q3k3/8/8/8/4B3/8/8/4RK2 w - - 0 1', solution: ['e4a8'],
        text: 'Your rook is lined up with the black king, but your bishop is in the way. Move the bishop with a discovered check — and win something big.',
        hint: 'The bishop can capture on the long diagonal.', success: 'Discovered check! Black must answer the rook check and cannot recapture.' },
    ],
  },
  {
    id: 'hanging', category: 'tactics', title: 'Free Pieces', summary: 'Spot undefended pieces.',
    steps: [
      { kind: 'info', title: 'Count attackers and defenders',
        text: 'Before every move, ask: which of my pieces are attacked, and which enemy pieces are undefended? A piece attacked more times than it is defended — or attacked by a cheaper piece — is in danger.' },
      { kind: 'move', title: 'Take the free piece', fen: '4k3/r5p1/5n2/8/3Q4/8/8/4K3 w - - 0 1', solution: ['d4a7'],
        text: 'Your queen can capture two black pieces. One is protected, one is not. Take the free one.',
        hint: 'The knight on f6 is protected by the g7 pawn. What about the rook?', success: 'Free material! Taking the knight would have lost your queen to ...gxf6.' },
    ],
  },
  {
    id: 'backrank', category: 'mates', title: 'Back-Rank Mate', summary: 'A king trapped behind its own pawns.',
    steps: [
      { kind: 'info', title: 'The back rank',
        text: 'When a castled king sits behind three unmoved pawns, a rook or queen on the back rank can deliver mate. Making a "window" for your king (like h3 or h6) prevents this.' },
      { kind: 'move', title: 'Mate on the back rank', fen: '4r1k1/5ppp/8/8/8/8/1Q3PPP/4R1K1 w - - 0 1', solution: ['e1e8'],
        text: 'Black has only one defender of the back rank. Checkmate in one.',
        hint: 'Capture the defender with check.', success: 'Checkmate. The pawns on f7, g7 and h7 imprison their own king.' },
    ],
  },
  {
    id: 'smothered', category: 'mates', title: 'Smothered Mate', summary: "The knight's signature checkmate.",
    steps: [
      { kind: 'info', title: 'Smothered',
        text: 'A smothered mate happens when a king is completely surrounded by its own pieces and a knight delivers check. Nothing can block a knight check.' },
      { kind: 'move', title: 'Knight mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['g5f7'],
        text: 'The black king is boxed in by its own rook and pawns. Mate with the knight.',
        hint: 'Which square attacks h8 with a knight?', success: 'Smothered mate!' },
      { kind: 'move', title: "Philidor's legacy", fen: 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', solution: ['b3g8', 'a8g8', 'h6f7'],
        text: 'A famous combination: sacrifice your queen to force the rook into the corner, then mate with the knight. Mate in two.',
        hint: 'Check on g8 — the king cannot take because your knight guards that square.', success: 'A beautiful queen sacrifice ending in smothered mate.' },
    ],
  },
  {
    id: 'kq-mate', category: 'endgames', title: 'Queen Checkmate', summary: 'Mate a lone king with king and queen.',
    steps: [
      { kind: 'info', title: 'Technique',
        text: 'Use the queen to shrink the box the enemy king can move in, staying a knight\'s move away from it. When the king is on the edge, bring your own king closer, then deliver mate. Always make sure the king has a legal move — or you stalemate.' },
      { kind: 'goal', title: 'Your turn', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', goal: 'mate', maxMoves: 15,
        text: 'Checkmate the black king within 15 moves. The engine will defend perfectly.', success: 'Textbook technique!' },
    ],
  },
  {
    id: 'kr-mate', category: 'endgames', title: 'Rook Checkmate', summary: 'Mate with king and rook.',
    steps: [
      { kind: 'info', title: 'Technique',
        text: 'With a rook, cut the enemy king off along a rank or file, then use your own king to take away squares — face the enemy king (opposition) and give a check along the edge. Keep the rook far from the enemy king so it cannot be attacked.' },
      { kind: 'goal', title: 'Your turn', fen: '8/8/8/3k4/8/8/8/R3K3 w - - 0 1', goal: 'mate', maxMoves: 25,
        text: 'Checkmate with king and rook within 25 moves.', success: 'Rook mates are essential knowledge — well done.' },
    ],
  },
  {
    id: 'opposition', category: 'endgames', title: 'King & Pawn', summary: 'Opposition and promoting a passed pawn.',
    steps: [
      { kind: 'info', title: 'Opposition',
        text: 'When the kings face each other with one square between them, the side that does NOT have to move "has the opposition". In king-and-pawn endings, using the opposition to put your king in front of the pawn is usually what decides the game.' },
      { kind: 'move', title: 'King first', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', solution: ['e3e4|e3d4|e3f4'],
        text: 'Pushing the pawn too early lets the black king block it. Advance your king first.',
        hint: 'Move the king up, in front of the pawn.', success: 'King in front of the pawn — exactly right.' },
      { kind: 'goal', title: 'Promote the pawn', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', goal: 'promote', maxMoves: 25,
        text: 'Now win the ending: promote your pawn against the engine\'s best defence.', success: 'Perfect technique: the king led and the pawn followed.' },
    ],
  },
];
