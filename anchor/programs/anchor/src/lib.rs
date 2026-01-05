use anchor_lang::prelude::*;

declare_id!("Hk6wh6upkJ8AgNFbvNzYJnPpZCu23WRy5TQTse1qRxzL");

#[program]
pub mod solgrid {
    use super::*;

    pub fn initialize_game(ctx: Context<InitializeGame>, player_two: Pubkey) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.player_one = ctx.accounts.player_one.key();
        game.player_two = player_two;
        game.current_turn = game.player_one; // P1 starts
        game.turn_count = 0;
        game.board_state = Vec::new();
        game.game_status = GameStatus::Active;
        game.bump = ctx.bumps.game;
        
        msg!("Game initialized! P1: {}, P2: {}", game.player_one, game.player_two);
        Ok(())
    }

    pub fn make_move(ctx: Context<MakeMove>, move_id: String) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let signer = &ctx.accounts.player;

        // 1. Check if game is active
        require!(game.game_status == GameStatus::Active, GameError::GameNotActive);

        // 2. Check turn
        require!(game.current_turn == signer.key(), GameError::NotYourTurn);

        // 3. Check if move already made
        // Note: linear search is O(N), max moves = (5*4 + 4*5) = 40 lines. Cheap.
        require!(!game.board_state.contains(&move_id), GameError::MoveAlreadyMade);

        // 4. Record move
        game.board_state.push(move_id.clone());
        game.turn_count += 1;

        // 5. Switch turn
        if game.current_turn == game.player_one {
            game.current_turn = game.player_two;
        } else {
            game.current_turn = game.player_one;
        }

        msg!("Move made: {} by {}", move_id, signer.key());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,
    
    // The game account is a distinct PDA for every match? 
    // For simplicity, let's use a random seed or allowing the user to provide a seed would be better for multiple games.
    // Here we'll just generate a fresh account using a random seed passed by client, OR purely random Keypair (simpler for v1).
    // User requested "Single Game PDA per match". Let's use a seed. 
    #[account(
        init, 
        payer = player_one, 
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", player_one.key().as_ref(), player_two.key().as_ref()], // Simple seed: "game" + p1 + p2. LIMITATION: ONE GAME PER PAIR.
        bump
    )]
    pub game: Account<'info, Game>,

    /// CHECK: Just storing the pubkey
    pub player_two: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MakeMove<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>, // Must be P1 or P2
}

#[account]
pub struct Game {
    pub player_one: Pubkey,      // 32
    pub player_two: Pubkey,      // 32
    pub current_turn: Pubkey,    // 32
    pub turn_count: u16,         // 2
    pub game_status: GameStatus, // 1 + 1 (enum variant)
    pub bump: u8,                // 1
    
    // Dynamic vector. 
    // Anchor requires max space allocation. 
    // Max lines in 4x4 grid: (4+1)*4 horizontal + (4+1)*4 vertical = 20 + 20 = 40.
    // Each string is e.g. "h-3-3" (5 chars) + 4 bytes overhead? String storage is expensive.
    // Optimization: We could hash moves or use compact bytes, but prompt asked for "Readable".
    // Let's allocate enough for 40 strings of max length 8 ("v-10-10").
    // Vector overhead (4) + 40 * (4 + 8) = 4 + 480 = ~500 bytes.
    // Total Struct Size ~ 600 bytes.
    pub board_state: Vec<String>, 
}

impl Game {
    // 32*3 + 2 + 2 + 1 + 500 padding
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 2 + 2 + 1 + 600; 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameStatus {
    Active,
    Finished,
}

#[error_code]
pub enum GameError {
    #[msg("It is not your turn.")]
    NotYourTurn,
    #[msg("The game is not active.")]
    GameNotActive,
    #[msg("This move has already been made.")]
    MoveAlreadyMade,
}
