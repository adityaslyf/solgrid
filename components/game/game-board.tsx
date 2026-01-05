'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Trophy, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { useAnchorProgram } from '@/lib/useAnchorProgram';
import { PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';

type Player = 1 | 2;
type LineId = string; // Format: "h-r-c" (horizontal-row-col) or "v-r-c" (vertical-row-col)

interface GameState {
  lines: Set<LineId>;
  boxes: Record<string, Player>; // Key: "r-c"
  scores: { 1: number; 2: number };
  currentPlayer: Player;
  latestLine?: LineId;
  winner: Player | 'draw' | null;
  isActive: boolean;
}

const GRID_SIZE = 4; // 4x4 boxes means 5x5 dots

export function GameBoard() {
  const { publicKey, signTransaction } = useWallet();
  const program = useAnchorProgram();
  const [gamePda, setGamePda] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Session Wallet (Burner Keypair)
  // We store the secret key in memory (state) for this session.
  const [sessionKeypair, setSessionKeypair] = useState<Keypair | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    lines: new Set(),
    boxes: {},
    scores: { 1: 0, 2: 0 },
    currentPlayer: 1,
    latestLine: undefined,
    winner: null,
    isActive: false,
  });

  const isLineTaken = (id: LineId) => gameState.lines.has(id);

  // Helper: Derived from local state for immediate feedback
  const syncGameStateFromChain = useCallback(async () => {
     if (!program || !gamePda) return;
     try {
        const account = await program.account.game.fetch(gamePda);
        
        const lines = new Set<LineId>();
        const boxes: Record<string, Player> = {};
        let scores = { 1: 0, 2: 0 };
        let currentPlayer: Player = 1;
        
        account.boardState.forEach((moveId: string) => {
             lines.add(moveId);
             const [type, rStr, cStr] = moveId.split('-');
             const r = parseInt(rStr);
             const c = parseInt(cStr);
             
             let scoreGained = false;
             
             const boxesToCheck: string[] = [];
             if (type === 'h') {
                if (r < GRID_SIZE) boxesToCheck.push(`${r}-${c}`);
                if (r > 0) boxesToCheck.push(`${r - 1}-${c}`);
             } else {
                if (c < GRID_SIZE) boxesToCheck.push(`${r}-${c}`);
                if (c > 0) boxesToCheck.push(`${r}-${c - 1}`);
             }

             boxesToCheck.forEach(boxKey => {
                 if (boxes[boxKey]) return;
                 const [br, bc] = boxKey.split('-').map(Number);
                 const top = `h-${br}-${bc}`;
                 const bottom = `h-${br+1}-${bc}`;
                 const left = `v-${br}-${bc}`;
                 const right = `v-${br}-${bc+1}`;
                 
                 if (lines.has(top) && lines.has(bottom) && lines.has(left) && lines.has(right)) {
                     boxes[boxKey] = currentPlayer;
                     scoreGained = true;
                 }
             });

             if (scoreGained) {
                 scores = { 
                     1: Object.values(boxes).filter(p => p === 1).length,
                     2: Object.values(boxes).filter(p => p === 2).length
                 };
             } else {
                 currentPlayer = currentPlayer === 1 ? 2 : 1;
             }
        });

        let winner: Player | 'draw' | null = null;
        if (Object.keys(boxes).length === GRID_SIZE * GRID_SIZE) {
             winner = scores[1] > scores[2] ? 1 : scores[2] > scores[1] ? 2 : 'draw';
        }

        setGameState({
            lines,
            boxes,
            scores,
            currentPlayer,
            latestLine: account.boardState[account.boardState.length - 1],
            winner,
            isActive: true
        });

     } catch (e) {
         console.error("Failed to fetch game:", e);
     }
  }, [program, gamePda]);

  // Polling
  useEffect(() => {
      if (!gamePda) return;
      const interval = setInterval(syncGameStateFromChain, 2000);
      return () => clearInterval(interval);
  }, [gamePda, syncGameStateFromChain]);


  const initializeGame = async () => {
    if (!program || !publicKey || !signTransaction) return;
    setLoading(true);
    setError(null);
    try {
        // 1. Generate Session Wallet (Burner)
        const session = Keypair.generate();
        setSessionKeypair(session);
        console.log("Session Wallet Generated:", session.publicKey.toBase58());

        // For simplicity in this demo, P2 is the Session Wallet so it can act "autonomously"
        // In a real P2P match, both players would have their own session wallets.
        // Or if we play against ourselves, we set P2 = Session.
        const playerTwo = session.publicKey; 
        
        // P1 is the Main Wallet (needs to sign to fund) and start.
        // But if we want P1 to ALSO auto-sign, we should eventually set P1 = session too? 
        // For this demo: P1 = Main Wallet (Sign Init), P2 = Session Wallet (Auto Sign).
        // Wait, the goal is *P1* (You) not getting popups.
        // So actually, we want the Game to think *You* are the Session Wallet.
        
        // BETTER PLAN:
        // We initialize the game where P1 = Session Wallet, P2 = Session Wallet.
        // But the *payer* is the Main Wallet.
        // This way, the Session Wallet controls BOTH turns (Simulated Self-Play).
        
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("game"), session.publicKey.toBuffer(), session.publicKey.toBuffer()],
            program.programId
        );

        // 2. Fund Session Wallet & Init Game (Atomic Transaction)
        // Move 0.05 SOL to session wallet for fees
        const transferIx = SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: session.publicKey,
            lamports: 0.05 * LAMPORTS_PER_SOL,
        });

        const initIx = await program.methods.initializeGame(session.publicKey)
        .accounts({
            playerOne: session.publicKey, // Session is P1
            playerTwo: session.publicKey, // Session is P2 (Self Play)
            game: pda,
        })
        .instruction();

        // 3. Construct and Sign Transaction
        const tx = new Transaction().add(transferIx).add(initIx);
        tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;

        // Partially sign with Session Key (since it's a signer in initGame as P1)
        tx.partialSign(session);
        
        // Final sign with Main Wallet (Payer)
        const signedTx = await signTransaction(tx);
        
        // Send
        const sig = await program.provider.connection.sendRawTransaction(signedTx.serialize());
        await program.provider.connection.confirmTransaction(sig);

        setGamePda(pda);
        await syncGameStateFromChain();

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to start game");
    } finally {
        setLoading(false);
    }
  };

  const handleLineClick = async (id: LineId) => {
    if (!program || !gamePda || loading || isLineTaken(id) || gameState.winner) return;

    if (!sessionKeypair) {
        setError("No session wallet found. Please restart game.");
        return;
    }
    
    // Optimistic UI update
    // We can't really do full optimistic UI without duplicating logic, 
    // but we can at least show loading state.
    setLoading(true);

    try {
        // AUTO-SIGNING with Session Keypair
        // We create a custom provider momentarily or just build tx manually.
        // Easiest: Build instruction -> Sign with Keypair -> Send.
        
        const ix = await program.methods.makeMove(id)
        .accounts({
            game: gamePda,
            player: sessionKeypair.publicKey // Session wallet is the player
        })
        .instruction();

        const tx = new Transaction().add(ix);
        tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = sessionKeypair.publicKey; // Session pays gas! (It has funds)

        tx.sign(sessionKeypair);

        const sig = await program.provider.connection.sendRawTransaction(tx.serialize());
        // await program.provider.connection.confirmTransaction(sig); 
        // Don't await verification for UI happiness? 
        // No, await it to ensure sync is correct, but it's fast on localnet.
        await program.provider.connection.confirmTransaction(sig);

        await syncGameStateFromChain();
    } catch (err: any) {
        console.error(err);
        setError("Move failed: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const resetGame = () => {
    setGamePda(null);
    setSessionKeypair(null);
    setGameState({
      lines: new Set(),
      boxes: {},
      scores: { 1: 0, 2: 0 },
      currentPlayer: 1,
      latestLine: undefined,
      winner: null,
      isActive: false
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
                <div key={`dot-${r}-${c}`} className="relative z-20 flex items-center justify-center w-full h-full">
                    <div className="w-3 h-3 bg-muted-foreground/50 rounded-full hover:bg-white transition-colors duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
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
                        className={cn(
                            "relative h-full flex items-center justify-center cursor-pointer group",
                            loading && "pointer-events-none opacity-50"
                        )}
                    >
                        {/* Interactive Hitbox */}
                        <div className="absolute inset-x-0 -inset-y-4 z-10 bg-transparent" />
                        
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
                         className={cn(
                            "relative w-full flex justify-center cursor-pointer group",
                            loading && "pointer-events-none opacity-50"
                        )}
                    >
                         {/* Interactive Hitbox */}
                         <div className="absolute inset-y-0 -inset-x-4 z-10 bg-transparent" />

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

  // If not connected or not active, show Start View
  if (!gamePda && !gameState.isActive) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md mx-auto glass-card rounded-2xl">
            <Trophy className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-2xl font-bold text-white text-center">Ready to Play?</h2>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            
            {!publicKey ? (
                 <p className="text-muted-foreground text-center">Connect your wallet in the navigation bar to start.</p>
            ) : (
                <div className="space-y-4 w-full">
                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-start gap-4 text-left">
                        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-semibold text-primary text-sm">Session Wallet Enabled</p>
                            <p className="text-xs text-muted-foreground">
                                We will create a temporary wallet and fund it (0.05 SOL) to 
                                <span className="text-white font-medium"> auto-sign your moves</span>. 
                                You only approve one transaction to start.
                            </p>
                        </div>
                    </div>

                     <Button 
                        size="lg" 
                        className="w-full" 
                        onClick={initializeGame}
                        isLoading={loading}
                    >
                         <Zap className="mr-2 w-4 h-4" /> Start Instant Match
                    </Button>
                </div>
            )}
        </div>
      );
  }

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
                <div className="flex flex-col items-center gap-2">
                     <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-1 rounded">
                         Session Mode
                     </span>
                     <div className="text-sm font-medium text-muted-foreground/50 tracking-[0.2em]">VS</div>
                </div>
            )}
        </div>

        <div className={cn("flex flex-col items-center transition-all duration-300 p-4 rounded-xl", gameState.currentPlayer === 2 ? "bg-secondary/10 shadow-[0_0_20px_hsl(var(--secondary)/0.1)]" : "opacity-60")}>
          <span className="text-sm font-bold text-secondary uppercase tracking-widest">Player 2</span>
          <span className="text-5xl font-black text-white mt-1">{gameState.scores[2]}</span>
        </div>
      </div>

      {/* The Grid Board - CSS GRID IMPLEMENTATION */}
      <div className="p-8 rounded-2xl bg-black/60 border border-white/10 shadow-2xl backdrop-blur-xl relative">
        {loading && (
             <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                 <RefreshCw className="w-10 h-10 text-primary animate-spin" />
             </div>
        )}
        <div 
          style={{
             display: 'grid',
             gridTemplateColumns: `16px repeat(${GRID_SIZE}, 100px 16px)`,
             gridTemplateRows: `16px repeat(${GRID_SIZE}, 100px 16px)`,
             gap: '0px'
          }}
        >
             {renderGrid()}
        </div>
      </div>

       { /* Status / Error Bar */ }
       <div className="h-6">
           {error && <span className="text-red-500 text-sm animate-pulse">{error}</span>}
       </div>

       {/* Reset / Actions */}
       <Button variant="glass" onClick={resetGame} className="gap-2 text-muted-foreground hover:text-white border-white/5 hover:bg-white/5">
         <RefreshCw className="w-4 h-4" /> Exit Game
       </Button>
    </div>
  );
}
