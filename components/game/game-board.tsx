'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Trophy, RefreshCw } from 'lucide-react';

type Player = 1 | 2;
type LineId = string; // Format: "h-r-c" (horizontal-row-col) or "v-r-c" (vertical-row-col)

interface GameState {
  lines: Set<LineId>;
  boxes: Record<string, Player>; // Key: "r-c"
  scores: { 1: number; 2: number };
  currentPlayer: Player;
  latestLine?: LineId;
  winner: Player | 'draw' | null;
}

const GRID_SIZE = 4; // 4x4 boxes means 5x5 dots

export function GameBoard() {
  const [gameState, setGameState] = useState<GameState>({
    lines: new Set(),
    boxes: {},
    scores: { 1: 0, 2: 0 },
    currentPlayer: 1,
    winner: null,
  });

  const isLineTaken = (id: LineId) => gameState.lines.has(id);

  const checkBoxes = (lines: Set<LineId>, lastMove: LineId) => {
    const newBoxes: Record<string, Player> = { ...gameState.boxes };
    let scoreGained = false;
    
    // Parse the move
    const [type, rStr, cStr] = lastMove.split('-');
    const r = parseInt(rStr);
    const c = parseInt(cStr);

    // Potential boxes to check depend on the line type
    // If we placed a Horizontal line at r,c:
    // It could be the TOP of box (r, c)
    // It could be the BOTTOM of box (r-1, c)
    const boxesToCheck: string[] = [];

    if (type === 'h') {
        // Horizontal line at row r, col c connects (r,c) to (r, c+1)
        // This line is the Top of box(r, c)
        if (r < GRID_SIZE) boxesToCheck.push(`${r}-${c}`);
        // This line is the Bottom of box(r-1, c)
        if (r > 0) boxesToCheck.push(`${r - 1}-${c}`);
    } else {
        // Vertical line at row r, col c connects (r,c) to (r+1,c)
        // This line is the Left of box(r, c)
        if (c < GRID_SIZE) boxesToCheck.push(`${r}-${c}`);
        // This line is the Right of box(r, c-1)
        if (c > 0) boxesToCheck.push(`${r}-${c - 1}`);
    }

    const currentPlr = gameState.currentPlayer;

    boxesToCheck.forEach(boxKey => {
      if (newBoxes[boxKey]) return; // Already taken

      const [br, bc] = boxKey.split('-').map(Number);
      // Box(br, bc) is formed by:
      // Top: h-br-bc
      // Bottom: h-(br+1)-bc
      // Left: v-br-bc
      // Right: v-br-(bc+1)
      const top = `h-${br}-${bc}`;
      const bottom = `h-${br + 1}-${bc}`;
      const left = `v-${br}-${bc}`;
      const right = `v-${br}-${bc + 1}`;

      if (lines.has(top) && lines.has(bottom) && lines.has(left) && lines.has(right)) {
        newBoxes[boxKey] = currentPlr;
        scoreGained = true;
      }
    });

    return { newBoxes, scoreGained };
  };

  const handleLineClick = (id: LineId) => {
    if (gameState.winner || isLineTaken(id)) return;

    const newLines = new Set(gameState.lines);
    newLines.add(id);

    const { newBoxes, scoreGained } = checkBoxes(newLines, id);

    let nextPlayer = gameState.currentPlayer;
    let newScores = { ...gameState.scores };

    if (scoreGained) {
      const p1Score = Object.values(newBoxes).filter(p => p === 1).length;
      const p2Score = Object.values(newBoxes).filter(p => p === 2).length;
      newScores = { 1: p1Score, 2: p2Score };
      
      if (p1Score + p2Score === GRID_SIZE * GRID_SIZE) {
        setGameState(prev => ({
          ...prev,
          lines: newLines,
          boxes: newBoxes,
          scores: newScores,
          latestLine: id,
          winner: p1Score > p2Score ? 1 : p2Score > p1Score ? 2 : 'draw'
        }));
        return;
      }
    } else {
      nextPlayer = nextPlayer === 1 ? 2 : 1;
    }

    setGameState({
      lines: newLines,
      boxes: newBoxes,
      scores: newScores,
      currentPlayer: nextPlayer,
      latestLine: id,
      winner: null,
    });
  };

  const resetGame = () => {
    setGameState({
      lines: new Set(),
      boxes: {},
      scores: { 1: 0, 2: 0 },
      currentPlayer: 1,
      latestLine: undefined,
      winner: null,
    });
  };

  // Helper to render the grid using CSS Grid
  const renderGrid = () => {
    const dotsCount = GRID_SIZE + 1;
    const items = [];

    // We cycle through rows and cols
    // effectively 2*GRID_SIZE + 1 rows/cols in the visual grid
    for (let r = 0; r < dotsCount; r++) {
        // --- ROW OF DOTS AND HORIZONTAL LINES ---
        for (let c = 0; c < dotsCount; c++) {
            // 1. The Dot
            items.push(
                <div key={`dot-${r}-${c}`} className="relative z-20 flex items-center justify-center w-4 h-4">
                    <div className="w-3 h-3 bg-muted-foreground/50 rounded-full hover:bg-white transition-colors duration-300" />
                </div>
            );

            // 2. Horizontal Line (to the right of the dot, if not last column)
            if (c < GRID_SIZE) {
                const hLineId = `h-${r}-${c}`;
                const taken = isLineTaken(hLineId);
                const isLatest = gameState.latestLine === hLineId;
                items.push(
                    <div 
                        key={hLineId}
                        onClick={() => handleLineClick(hLineId)}
                        className="relative h-4 flex items-center justify-center cursor-pointer group"
                    >
                        {/* Interactive Hitbox */}
                        <div className="absolute inset-x-0 -inset-y-2 z-10 bg-transparent" />
                        
                        {/* Visible Line */}
                        <div className={cn(
                            "h-1.5 w-full rounded-full transition-all duration-300",
                            taken 
                                ? (isLatest ? "bg-white shadow-[0_0_15px_white]" : "bg-neutral-600")
                                : "bg-white/5 group-hover:bg-white/30 scale-x-90 group-hover:scale-x-100"
                        )} />
                    </div>
                );
            }
        }

        // --- ROW OF VERTICAL LINES AND BOXES (if not last row) ---
        if (r < GRID_SIZE) {
            for (let c = 0; c < dotsCount; c++) {
                // 3. Vertical Line (below the dot)
                const vLineId = `v-${r}-${c}`;
                const taken = isLineTaken(vLineId);
                const isLatest = gameState.latestLine === vLineId;
                
                items.push(
                    <div 
                        key={vLineId}
                        onClick={() => handleLineClick(vLineId)}
                        className="relative w-4 flex justify-center cursor-pointer group py-0"
                    >
                         {/* Interactive Hitbox */}
                         <div className="absolute inset-y-0 -inset-x-2 z-10 bg-transparent" />

                        {/* Visible Line */}
                        <div className={cn(
                            "w-1.5 h-full rounded-full transition-all duration-300",
                            taken 
                                ? (isLatest ? "bg-white shadow-[0_0_15px_white]" : "bg-neutral-600")
                                : "bg-white/5 group-hover:bg-white/30 scale-y-90 group-hover:scale-y-100"
                        )} />
                    </div>
                );

                // 4. The Box Content (to the right of vertical line)
                if (c < GRID_SIZE) {
                    const boxId = `${r}-${c}`;
                    const owner = gameState.boxes[boxId];
                    items.push(
                        <div key={`box-${boxId}`} className="relative w-full h-full flex items-center justify-center">
                             {owner && (
                                <motion.div 
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className={cn(
                                        "w-[85%] h-[85%] rounded-lg flex items-center justify-center",
                                        owner === 1 
                                            ? "bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.25)] border border-primary/30" 
                                            : "bg-secondary/20 shadow-[0_0_20px_hsl(var(--secondary)/0.25)] border border-secondary/30"
                                    )}
                                >
                                  {/* Optional: Owner Icon or Initial */}
                                  <span className={cn("font-bold text-2xl select-none", owner === 1 ? "text-primary dark:text-primary" : "text-secondary dark:text-secondary")}>
                                    {owner === 1 ? "P1" : "P2"}
                                  </span>
                                </motion.div>
                             )}
                        </div>
                    );
                }
            }
        }
    }
    return items;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-8 p-6">
      {/* HUD / Scoreboard */}
      <div className="w-full flex justify-between items-center glass-card p-6 rounded-2xl border border-white/10 bg-black/40 shadow-xl">
        <div className={cn("flex flex-col items-center transition-all duration-300 p-4 rounded-xl", gameState.currentPlayer === 1 ? "bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.1)]" : "opacity-60")}>
          <span className="text-sm font-bold text-primary uppercase tracking-widest">Player 1</span>
          <span className="text-5xl font-black text-white mt-1">{gameState.scores[1]}</span>
        </div>

        <div className="flex flex-col items-center px-8">
            {gameState.winner ? (
                <motion.div 
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1.2, rotate: 0 }}
                    className="flex flex-col items-center"
                >
                    <Trophy className="w-10 h-10 text-yellow-400 mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                        {gameState.winner === 'draw' ? 'Draw!' : `Player ${gameState.winner} Wins!`}
                    </span>
                </motion.div>
            ) : (
                <div className="text-sm font-medium text-muted-foreground/50 tracking-[0.2em]">VS</div>
            )}
        </div>

        <div className={cn("flex flex-col items-center transition-all duration-300 p-4 rounded-xl", gameState.currentPlayer === 2 ? "bg-secondary/10 shadow-[0_0_20px_hsl(var(--secondary)/0.1)]" : "opacity-60")}>
          <span className="text-sm font-bold text-secondary uppercase tracking-widest">Player 2</span>
          <span className="text-5xl font-black text-white mt-1">{gameState.scores[2]}</span>
        </div>
      </div>

      {/* The Grid Board - CSS GRID IMPLEMENTATION */}
      <div className="p-8 rounded-2xl bg-black/60 border border-white/10 shadow-2xl backdrop-blur-xl">
        <div 
          style={{
             display: 'grid',
             gridTemplateColumns: `max-content repeat(${GRID_SIZE}, 100px max-content)`, // 16px dot, 80px line, ...
             gridTemplateRows: `max-content repeat(${GRID_SIZE}, 100px max-content)`,   // 16px dot, 80px line, ...
             gap: '0px'
          }}
        >
             {renderGrid()}
        </div>
      </div>

       {/* Reset / Actions */}
       <Button variant="glass" onClick={resetGame} className="gap-2 text-muted-foreground hover:text-white border-white/5 hover:bg-white/5">
         <RefreshCw className="w-4 h-4" /> Reset Board
       </Button>
    </div>
  );
}
