import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solgrid } from "../target/types/solgrid";
import { assert } from "chai";

describe("solgrid", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.solgrid as Program<Solgrid>;
  
  // Game PDA
  let gamePda: anchor.web3.PublicKey;
  let gameBump: number;

  // Players
  const playerOne = provider.wallet;
  const playerTwo = anchor.web3.Keypair.generate();

  it("Is initialized!", async () => {
    // Derive PDA
    [gamePda, gameBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .initializeGame(playerTwo.publicKey)
      .accounts({
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        game: gamePda,
      })
      .rpc();

    const gameState = await program.account.game.fetch(gamePda);
    assert.ok(gameState.playerOne.equals(playerOne.publicKey));
    assert.ok(gameState.playerTwo.equals(playerTwo.publicKey));
    assert.ok(gameState.currentTurn.equals(playerOne.publicKey));
    assert.equal(gameState.turnCount, 0);
    assert.deepEqual(gameState.gameStatus, { active: {} });
  });

  it("P1 makes a move", async () => {
    const moveId = "h-0-0";
    await program.methods
    .makeMove(moveId)
    .accounts({
        game: gamePda,
        player: playerOne.publicKey,
    })
    .rpc();

    const gameState = await program.account.game.fetch(gamePda);
    assert.equal(gameState.boardState[0], moveId);
    assert.ok(gameState.currentTurn.equals(playerTwo.publicKey)); // Turn should switch
  });

  it("P2 makes a move", async () => {
    // We need to sign as P2. 
    // Since P2 is a Keypair, we pass it as a signer.
    const moveId = "v-0-0";
    await program.methods
    .makeMove(moveId)
    .accounts({
        game: gamePda,
        player: playerTwo.publicKey,
    })
    .signers([playerTwo])
    .rpc();

    const gameState = await program.account.game.fetch(gamePda);
    assert.equal(gameState.boardState[1], moveId);
    assert.ok(gameState.currentTurn.equals(playerOne.publicKey)); // Turn should switch back to P1
  });

  it("Prevents double moves", async () => {
    try {
        await program.methods
        .makeMove("h-0-0") // Already taken by P1
        .accounts({
            game: gamePda,
            player: playerOne.publicKey,
        })
        .rpc();
        assert.fail("Should have failed");
    } catch (e) {
        assert.include(e.toString(), "MoveAlreadyMade");
    }
  });

  it("Prevents playing out of turn", async () => {
    try {
        await program.methods
        .makeMove("h-3-3") 
        .accounts({
            game: gamePda,
            player: playerTwo.publicKey, // It is P1's turn
        })
        .signers([playerTwo])
        .rpc();
        assert.fail("Should have failed");
    } catch (e) {
        assert.include(e.toString(), "NotYourTurn");
    }
  });
});
