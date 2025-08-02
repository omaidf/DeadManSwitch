use anchor_lang::prelude::*;

declare_id!("DGem8q4roVXeWd2TspeusigCoX28K7DbwhvWN6qy9hgU");

// Constants
const MAX_PING_INTERVAL: i64 = 365 * 24 * 60 * 60; // 1 year
const MIN_PING_INTERVAL: i64 = 60; // 1 minute
const MAX_DATA_SIZE: usize = 512; // Maximum encrypted data size in bytes

#[program]
mod dead_mans_switch {
    use super::*;

    /// Creates a new dead man's switch
    pub fn create_switch(
        ctx: Context<CreateSwitch>,
        id: u64,
        ping_interval: i64,
        encrypted_data: Vec<u8>,
    ) -> Result<()> {
        // Validate inputs
        require!(id > 0, ErrorCode::InvalidSwitchId);
        require!(
            ping_interval >= MIN_PING_INTERVAL && ping_interval <= MAX_PING_INTERVAL,
            ErrorCode::InvalidInterval
        );
        require!(
            encrypted_data.len() <= MAX_DATA_SIZE,
            ErrorCode::DataTooLarge
        );
        require!(!encrypted_data.is_empty(), ErrorCode::EmptyData);

        let switch = &mut ctx.accounts.switch;
        let current_time = Clock::get()?.unix_timestamp;

        // Initialize account
        switch.owner = *ctx.accounts.owner.key;
        switch.last_ping = current_time;
        switch.ping_interval = ping_interval;

        // Copy encrypted data to fixed array
        switch.encrypted_data = [0u8; MAX_DATA_SIZE];
        switch.encrypted_data[..encrypted_data.len()].copy_from_slice(&encrypted_data);
        switch.data_length = encrypted_data.len() as u16;

        switch.created_at = current_time;
        switch.bump = ctx.bumps.switch;

        let expiration_time = current_time
            .checked_add(ping_interval)
            .ok_or(ErrorCode::TimeOverflow)?;

        emit!(SwitchCreated {
            switch: switch.key(),
            owner: *ctx.accounts.owner.key,
            switch_id: id,
            ping_interval,
            expiration_time,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Resets the switch's expiration timer
    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        let switch = &mut ctx.accounts.switch;
        let current_time = Clock::get()?.unix_timestamp;

        // Security checks
        require!(!is_expired(switch, current_time), ErrorCode::Expired);
        require!(current_time >= switch.last_ping, ErrorCode::InvalidTimestamp);

        switch.last_ping = current_time;

        let new_expiration = current_time
            .checked_add(switch.ping_interval)
            .ok_or(ErrorCode::TimeOverflow)?;

        emit!(SwitchPinged {
            owner: switch.owner,
            switch_key: switch.key(),
            next_required_ping: new_expiration,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Check if a switch has expired (read-only)
    pub fn check_expiration(ctx: Context<CheckExpiration>) -> Result<bool> {
        let switch = &ctx.accounts.switch;
        let current_time = Clock::get()?.unix_timestamp;
        Ok(is_expired(switch, current_time))
    }

    /// Get switch info with expiration status (read-only)
    pub fn get_switch_info(ctx: Context<GetSwitchInfo>) -> Result<SwitchInfo> {
        let switch = &ctx.accounts.switch;
        let current_time = Clock::get()?.unix_timestamp;
        let expired = is_expired(switch, current_time);

        let expiration_time = switch
            .last_ping
            .checked_add(switch.ping_interval)
            .unwrap_or(i64::MAX);

        Ok(SwitchInfo {
            owner: switch.owner,
            expired,
            last_ping: switch.last_ping,
            ping_interval: switch.ping_interval,
            created_at: switch.created_at,
            expiration_time,
            current_time,
        })
    }

    /// Closes an expired switch account and recovers rent
    pub fn close_switch(ctx: Context<CloseSwitch>) -> Result<()> {
        let switch = &ctx.accounts.switch;
        let current_time = Clock::get()?.unix_timestamp;

        // Security checks
        require!(is_expired(switch, current_time), ErrorCode::NotExpired);
        require!(
            switch.owner == *ctx.accounts.owner.key,
            ErrorCode::Unauthorized
        );

        emit!(SwitchClosed {
            switch: switch.key(),
            owner: *ctx.accounts.owner.key,
            recovered_lamports: ctx.accounts.switch.to_account_info().lamports(),
            timestamp: current_time,
        });

        Ok(())
    }
}

/// Checks if a switch is expired
fn is_expired(switch: &DeadManSwitch, current_time: i64) -> bool {
    switch
        .last_ping
        .checked_add(switch.ping_interval)
        .map_or(true, |expiration| current_time >= expiration)
}

/// Main switch storage account
#[account]
pub struct DeadManSwitch {
    pub owner: Pubkey,                       // Switch owner (32 bytes)
    pub last_ping: i64,                      // Last ping timestamp (8 bytes)
    pub ping_interval: i64,                  // Required ping interval (8 bytes)
    pub encrypted_data: [u8; MAX_DATA_SIZE], // Encrypted message (512 bytes fixed)
    pub data_length: u16,                    // Actual data length (2 bytes)
    pub created_at: i64,                     // Creation timestamp (8 bytes)
    pub bump: u8,                            // PDA bump (1 byte)
}

impl DeadManSwitch {
    /// Get the actual encrypted data as a slice
    pub fn get_encrypted_data(&self) -> &[u8] {
        &self.encrypted_data[..self.data_length as usize]
    }
}

/// Switch information struct for client responses
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SwitchInfo {
    pub owner: Pubkey,
    pub expired: bool,
    pub last_ping: i64,
    pub ping_interval: i64,
    pub created_at: i64,
    pub expiration_time: i64,
    pub current_time: i64,
}

// ===== Account Validation Structs ===== //

#[derive(Accounts)]
#[instruction(id: u64, ping_interval: i64, encrypted_data: Vec<u8>)]
pub struct CreateSwitch<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 8 + 8 + MAX_DATA_SIZE + 2 + 8 + 1,
        seeds = [b"switch", owner.key.as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub switch: Account<'info, DeadManSwitch>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Ping<'info> {
    #[account(
        mut,
        has_one = owner,
    )]
    pub switch: Account<'info, DeadManSwitch>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckExpiration<'info> {
    pub switch: Account<'info, DeadManSwitch>,
}

#[derive(Accounts)]
pub struct GetSwitchInfo<'info> {
    pub switch: Account<'info, DeadManSwitch>,
}

#[derive(Accounts)]
pub struct CloseSwitch<'info> {
    #[account(
        mut,
        has_one = owner,
        close = owner,
    )]
    pub switch: Account<'info, DeadManSwitch>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

// ===== Events ===== //

#[event]
pub struct SwitchCreated {
    pub switch: Pubkey,       // Switch account address
    pub owner: Pubkey,        // Owner public key
    pub switch_id: u64,       // Unique switch ID
    pub ping_interval: i64,   // Ping interval in seconds
    pub expiration_time: i64, // Initial expiration timestamp
    pub timestamp: i64,       // Creation timestamp
}

#[event]
pub struct SwitchPinged {
    pub owner: Pubkey,           // Owner public key
    pub switch_key: Pubkey,      // Switch account address
    pub next_required_ping: i64, // Next required ping timestamp
    pub timestamp: i64,          // Ping timestamp
}

#[event]
pub struct SwitchClosed {
    pub switch: Pubkey,          // Closed switch address
    pub owner: Pubkey,           // Owner who received funds
    pub recovered_lamports: u64, // Amount of SOL recovered
    pub timestamp: i64,          // Closure timestamp
}

// ===== Error Codes ===== //

#[error_code]
pub enum ErrorCode {
    #[msg("Ping interval must be between 60 seconds and 1 year")]
    InvalidInterval,
    #[msg("Encrypted data is too large (max 512 bytes)")]
    DataTooLarge,
    #[msg("Encrypted data cannot be empty")]
    EmptyData,
    #[msg("Time overflow during calculation")]
    TimeOverflow,
    #[msg("Invalid switch ID")]
    InvalidSwitchId,
    #[msg("Unauthorized operation")]
    Unauthorized,
    #[msg("Switch has expired and cannot be pinged")]
    Expired,
    #[msg("Switch has not expired yet")]
    NotExpired,
    #[msg("Invalid timestamp detected")]
    InvalidTimestamp,
}
