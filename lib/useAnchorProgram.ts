import { useMemo } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, Idl, setProvider } from '@coral-xyz/anchor';
import { Solgrid } from './solgrid'; // Path to your generated IDL types
import IDL from '../anchor/target/idl/solgrid.json';
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey("Hk6wh6upkJ8AgNFbvNzYJnPpZCu23WRy5TQTse1qRxzL");

export function useAnchorProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      preflightCommitment: 'processed',
    });
    setProvider(provider);

    // Cast raw JSON to Idl. 
    // In newer Anchor versions, we can strict type this better if we import the type.
    // For now, this is standard pattern.
    return new Program(IDL as unknown as Idl, provider) as unknown as Program<Solgrid>;
  }, [connection, wallet]);

  return program;
}
