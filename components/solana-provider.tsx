'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaProvider({ children }: { children: React.ReactNode }) {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint.
    // For local development, use "http://127.0.0.1:8899"
    // For production/devnet, use clusterApiUrl(network)
    const endpoint = useMemo(() => "http://127.0.0.1:8899", []);

    const wallets = useMemo(
        () => [
            /**
             * Wallets that support either the standard wallet adapter protocol or the
             * standard wallet standard are added here.
             *
             * Most current wallets (Phantom, Solflare, etc.) are supported out of the box
             * by @solana/wallet-adapter-wallets or standard discovery.
             */
             // Add any specific adapters here if needed, but modern wallets are auto-detected
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
