use anchor_lang::prelude::*;

declare_id!("Hk6wh6upkJ8AgNFbvNzYJnPpZCu23WRy5TQTse1qRxzL");

#[program]
pub mod solgrid {
    use super::*;

    pub fn initialize_game(ctx: Context<InitializeGame>, game_id: String) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.player_one = ctx.accounts.player_one.key();
        // game.player_two is None initially (or zero key)
        game.current_turn = game.player_one; 
        game.turn_count = 0;
        game.board_state = Vec::new();
        game.game_status = GameStatus::WaitingForOpponent;
        game.bump = ctx.bumps.game;
        game.game_id = game_id;
        
        msg!("Game initialized! P1: {}", game.player_one);
        Ok(())
    }

    pub fn join_game(ctx: Context<JoinGame>, _game_id: String) -> Result<()> {
        let game = &mut ctx.accounts.game;
        
        require!(game.game_status == GameStatus::WaitingForOpponent, GameError::GameAlreadyStarted);
        require!(game.player_one != ctx.accounts.player_two.key(), GameError::CannotPlayAgainstSelf);

        game.player_two = ctx.accounts.player_two.key();
        game.game_status = GameStatus::Active;
        
        msg!("Player 2 joined! P2: {}", game.player_two);
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
#[instruction(game_id: String)]
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub player_one: Signer<'info>,
    
    #[account(
        init, 
        payer = player_one, 
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", game_id.as_bytes()], 
        bump
    )]
    pub game: Account<'info, Game>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct JoinGame<'info> {
    #[account(
        mut, 
        seeds = [b"game", game_id.as_bytes()], 
        bump = game.bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut)]
    pub player_two: Signer<'info>,
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
    
    // Max ID length? user might provide long string. 
    // Let's cap seeds at standard length but inside the struct we need to store it?
    // Not strictly necessary to store inside if it's in the seed, 
    // but useful for validation. String overhead = 4 + len. Alloc 50 chars?
    pub game_id: String, 
    
    pub board_state: Vec<String>, 
}

impl Game {
    // 32*3 + 2 + 2 + 1 + 600 + (4+50) for game_id
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 2 + 2 + 1 + 600 + 64; 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameStatus {
    WaitingForOpponent,
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
    #[msg("Game already started.")]
    GameAlreadyStarted,
    #[msg("Cannot play against yourself (in P2P mode).")]
    CannotPlayAgainstSelf,
}
