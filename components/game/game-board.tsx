'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Trophy, RefreshCw, Zap, ShieldCheck, Copy, Check, Users } from 'lucide-react';
import { useAnchorProgram } from '@/lib/useAnchorProgram';
import { PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { nanoid } from 'nanoid';
import { useSearchParams, useRouter } from 'next/navigation';

type Player = 1 | 2;
type LineId = string;

interface GameState {
  lines: Set<LineId>;
  boxes: Record<string, Player>;
  scores: { 1: number; 2: number };
  currentPlayer: Player;
  latestLine?: LineId;
  winner: Player | 'draw' | null;
  status: 'active' | 'waiting' | 'finished';
  playerTwoPubkey?: string;
}

const GRID_SIZE = 4;

export function GameBoard() {
  const { publicKey, signTransaction } = useWallet();
  const program = useAnchorProgram();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get('game');

  const [gameId, setGameId] = useState<string | null>(urlGameId);
  const [gamePda, setGamePda] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [sessionKeypair, setSessionKeypair] = useState<Keypair | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    lines: new Set(),
    boxes: {},
    scores: { 1: 0, 2: 0 },
    currentPlayer: 1,
    latestLine: undefined,
    winner: null,
    status: 'waiting',
  });

  const isLineTaken = (id: LineId) => gameState.lines.has(id);

  // Sync state from chain
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

        const isWaiting = JSON.stringify(account.gameStatus) === JSON.stringify({ waitingForOpponent: {} });
        const isActive = JSON.stringify(account.gameStatus) === JSON.stringify({ active: {} });
        
        // Winner Check
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
            status: isWaiting ? 'waiting' : 'active',
            playerTwoPubkey: account.playerTwo?.toBase58()
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

  // Derive PDA if gameId exists
  useEffect(() => {
    if (gameId && program) {
         const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("game"), Buffer.from(gameId)],
            program.programId
        );
        setGamePda(pda);
    }
  }, [gameId, program]);


  const copyLink = () => {
    const url = `${window.location.origin}/?game=${gameId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initGame = async (isJoin: boolean) => {
    if (!program || !publicKey || !signTransaction) return;
    setLoading(true);
    setError(null);
    try {
        const session = Keypair.generate();
        setSessionKeypair(session);
        
        // 1. Determine Game ID
        const targetGameId = isJoin && urlGameId ? urlGameId : nanoid(8);
        
        // 2. Derive PDA
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("game"), Buffer.from(targetGameId)],
            program.programId
        );

        // 3. Fund Session Wallet
        const transferIx = SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: session.publicKey,
            lamports: 0.05 * LAMPORTS_PER_SOL,
        });

        // 4. Build Instruction (Init or Join)
        let ix;
        if (isJoin) {
             ix = await program.methods.joinGame(targetGameId)
             .accounts({
                 game: pda,
                 playerTwo: session.publicKey,
             } as any)
             .instruction();
        } else {
             ix = await program.methods.initializeGame(targetGameId)
             .accounts({
                 playerOne: session.publicKey,
                 game: pda,
             } as any)
             .instruction();
        }

        const tx = new Transaction().add(transferIx).add(ix);
        tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;

        tx.partialSign(session);
        const signedTx = await signTransaction(tx);
        
        const sig = await program.provider.connection.sendRawTransaction(signedTx.serialize());
        await program.provider.connection.confirmTransaction(sig);

        setGameId(targetGameId);
        setGamePda(pda);
        
        // Update URL without reload
        window.history.pushState({}, '', `/?game=${targetGameId}`);

        await syncGameStateFromChain();

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to start game");
    } finally {
        setLoading(false);
    }
  };

  const handleLineClick = async (id: LineId) => {
    if (!program || !gamePda || loading || isLineTaken(id) || gameState.winner || gameState.status === 'waiting') return;

    if (!sessionKeypair) {
        setError("No session wallet found. Please refresh.");
        return;
    }
    
    // Turn Check (Client Side safety)
    // We assume Session is P1 if we created, P2 if we joined.
    // Wait, the session is ephemeral. Does the contract know?
    // Contract records `player_one` as the Session Public Key.
    // We need to know: Am I P1 or P2?
    // We can infer by checking if `game.playerOne` === sessionKeypair.publicKey
    // But we need to fetch game state first or store it.
    // Let's assume we are allowed and let contract fail if not.
    
    setLoading(true);
    try {
        const ix = await program.methods.makeMove(id)
        .accounts({
            game: gamePda,
            player: sessionKeypair.publicKey 
        })
        .instruction();

        const tx = new Transaction().add(ix);
        tx.recentBlockhash = (await program.provider.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = sessionKeypair.publicKey;

        tx.sign(sessionKeypair);

        const sig = await program.provider.connection.sendRawTransaction(tx.serialize());
        await program.provider.connection.confirmTransaction(sig);

        await syncGameStateFromChain();
    } catch (err: any) {
        console.error(err);
        setError("Move failed: Not your turn!");
    } finally {
        setLoading(false);
    }
  };

  const resetGame = () => {
    setGamePda(null);
    setGameId(null);
    setSessionKeypair(null);
    setGameState(prev => ({ ...prev, status: 'waiting', lines: new Set(), boxes: {}, winner: null }));
    router.push('/');
  };

  // Helper to render the grid using CSS Grid
  const renderGrid = () => {
    const dotsCount = GRID_SIZE + 1;
    const items = [];

    for (let r = 0; r < dotsCount; r++) {
        for (let c = 0; c < dotsCount; c++) {
            items.push(
                <div key={`dot-${r}-${c}`} className="relative z-20 flex items-center justify-center w-full h-full">
                    <div className="w-3 h-3 bg-muted-foreground/50 rounded-full hover:bg-white transition-colors duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                </div>
            );

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
                            (loading || gameState.status === 'waiting') && "pointer-events-none opacity-50"
                        )}
                    >
                        <div className="absolute inset-x-0 -inset-y-4 z-10 bg-transparent" />
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

        if (r < GRID_SIZE) {
            for (let c = 0; c < dotsCount; c++) {
                const vLineId = `v-${r}-${c}`;
                const taken = isLineTaken(vLineId);
                const isLatest = gameState.latestLine === vLineId;
                items.push(
                    <div 
                        key={vLineId}
                        onClick={() => handleLineClick(vLineId)}
                         className={cn(
                            "relative w-full flex justify-center cursor-pointer group",
                            (loading || gameState.status === 'waiting') && "pointer-events-none opacity-50"
                        )}
                    >
                         <div className="absolute inset-y-0 -inset-x-4 z-10 bg-transparent" />
                        <div className={cn(
                            "w-1.5 h-full rounded-full transition-all duration-300",
                            taken 
                                ? (isLatest ? "bg-white shadow-[0_0_15px_white]" : "bg-neutral-600")
                                : "bg-white/5 group-hover:bg-white/30 scale-y-90 group-hover:scale-y-100"
                        )} />
                    </div>
                );

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

  // --- RENDERING STATES ---

  // 1. Waiting Room (Initialized but no P2)
  // Only show if we have a session (we are the host) AND game is waiting
  if (gamePda && gameState.status === 'waiting' && sessionKeypair) {
      return (
         <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md mx-auto glass-card rounded-2xl animate-in fade-in zoom-in duration-500">
            <Users className="w-16 h-16 text-primary animate-pulse" />
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Waiting for Player 2...</h2>
                <p className="text-muted-foreground text-sm">Share this link with your friend to start.</p>
            </div>
            
            <div className="flex items-center gap-2 w-full">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-muted-foreground truncate font-mono">
                    {typeof window !== 'undefined' ? window.location.href : 'Loading...'}
                </div>
                <Button size="icon" variant="glass" onClick={copyLink}>
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
            </div>
            
            <Button variant="ghost" className="text-xs text-muted-foreground hover:text-red-400" onClick={resetGame}>
                Cancel Game
            </Button>
         </div>
      );
  }

  // 2. Start Screen (No Game Active OR Joining Game)
  // Show if:
  // A) No session (user hasn't joined/created yet)
  // B) AND (No game loaded OR Game is waiting)
  if (!sessionKeypair && (!gamePda || gameState.status === 'waiting')) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md mx-auto glass-card rounded-2xl">
            <Trophy className="w-16 h-16 text-primary mb-4" />
            <h2 className="text-2xl font-bold text-white text-center">
                {urlGameId ? "You've been challenged!" : "Ready to Play?"}
            </h2>
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

                    {urlGameId ? (
                         <Button 
                            size="lg" 
                            className="w-full" 
                            onClick={() => initGame(true)}
                            isLoading={loading}
                        >
                             <Zap className="mr-2 w-4 h-4" /> Join Game
                        </Button>
                    ) : (
                         <Button 
                            size="lg" 
                            className="w-full" 
                            onClick={() => initGame(false)}
                            isLoading={loading}
                        >
                             <Zap className="mr-2 w-4 h-4" /> Create New Game
                        </Button>
                    )}
                </div>
            )}
        </div>
      );
  }

  // 3. Active Game Board
  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-8 p-6">
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

      <div className="p-8 rounded-2xl bg-black/60 border border-white/10 shadow-2xl backdrop-blur-xl relative">
        {(loading || gameState.status === 'waiting') && (
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

       <div className="h-6">
           {error && <span className="text-red-500 text-sm animate-pulse">{error}</span>}
       </div>

       <Button variant="glass" onClick={resetGame} className="gap-2 text-muted-foreground hover:text-white border-white/5 hover:bg-white/5">
         <RefreshCw className="w-4 h-4" /> Exit Game
       </Button>
    </div>
  );
}
