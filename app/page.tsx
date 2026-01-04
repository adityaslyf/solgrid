'use client';

import { useState } from 'react';
import { GameBoard } from '@/components/game/game-board';
import { Button } from '@/components/ui/button';
import { Wallet, Info, Grid3x3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock wallet connection
  const handleConnect = () => {
    setIsConnected(true);
  };

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-secondary/20 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

        {/* Navbar */}
        <header className="w-full h-20 flex items-center justify-between px-6 md:px-12 z-50 glass-panel border-b border-white/5 fixed top-0 left-0 right-0">
            <div className="flex items-center gap-2">
                <Grid3x3 className="w-8 h-8 text-primary" />
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    SolGrid
                </span>
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="hidden md:flex gap-2">
                    <Info className="w-4 h-4" /> How to Play
                </Button>
                <Button 
                    variant={isConnected ? "outline" : "primary"} 
                    onClick={handleConnect}
                    className="min-w-[140px]"
                >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnected ? "0x12...34ABS" : "Connect Wallet"}
                </Button>
            </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 pt-24 pb-12 px-6 flex flex-col items-center justify-center z-10">
            {!isPlaying ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center text-center max-w-2xl space-y-8"
                >
                    <div className="space-y-4">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary">
                            SOLANA POWERED
                        </span>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
                            Strategic <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Dots & Boxes</span>
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                            Challenge opponents in the classic game of strategy reimagined for the blockchain. Claim boxes, earn points, and take the grid.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <Button 
                            size="lg" 
                            variant="primary" 
                            onClick={() => setIsPlaying(true)}
                            className="bg-gradient-to-r from-primary to-green-600 hover:from-primary/90 hover:to-green-600/90 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)]"
                        >
                            Start Game
                        </Button>
                        <Button size="lg" variant="secondary" className="bg-white/5 hover:bg-white/10 border-white/10">
                            Create Private Room
                        </Button>
                    </div>

                    {/* Stats or Feature highlights */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-white/5 w-full">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-white">4x4</span>
                            <span className="text-sm text-muted-foreground">Grid Size</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-white">Fast</span>
                            <span className="text-sm text-muted-foreground">Turn Based</span>
                        </div>
                         <div className="flex flex-col items-center col-span-2 md:col-span-1">
                            <span className="text-3xl font-bold text-white">0%</span>
                            <span className="text-sm text-muted-foreground">Platform Fee</span>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full flex flex-col items-center"
                >
                    <div className="mb-8 flex items-center gap-4">
                         <Button variant="ghost" onClick={() => setIsPlaying(false)} className="text-muted-foreground hover:text-white">
                            ← Back to Menu
                         </Button>
                    </div>
                    <GameBoard />
                </motion.div>
            )}
        </div>
    </main>
  );
}
