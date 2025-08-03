/**
 * Lit Action for DeadManSwitch Expiration Check
 * 
 * This Lit Action:
 * 1. Fetches the raw account data for a DeadManSwitch PDA
 * 2. Parses the account data according to the struct layout
 * 3. Checks if the switch has expired based on last_ping + ping_interval
 * 4. Returns true/false for access control
 */

const go = async () => {
  // Switch PDA address to check (this would be passed as a parameter)
  const switchPDA = "6WxoKuS16j8evGpQZt9MaKugFx3YCQ7vMmQN32UCj4Ep";
  
  try {
    // 1. Fetch account data from Solana
    const rpcUrl = "https://api.devnet.solana.com";
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [
          switchPDA,
          {
            encoding: "base64",
            commitment: "confirmed"
          }
        ]
      })
    });

    const result = await response.json();
    
    if (!result.result || !result.result.value) {
      throw new Error("Account not found");
    }

    // 2. Parse the account data
    const accountDataBase64 = result.result.value.data[0];
    const accountDataBuffer = Uint8Array.from(atob(accountDataBase64), c => c.charCodeAt(0));
    
    // Parse according to DeadManSwitch struct layout (correct offsets):
    // After 8-byte Anchor discriminator:
    // owner: Pubkey (32 bytes) - offset 0
    // last_ping: i64 (8 bytes) - offset 32  
    // ping_interval: i64 (8 bytes) - offset 40
    // encrypted_data: [u8; 512] (512 bytes) - offset 48
    // data_length: u16 (2 bytes) - offset 560
    // created_at: i64 (8 bytes) - offset 562
    // bump: u8 (1 byte) - offset 570
    
    function parseDeadManSwitch(buffer) {
      let offset = 8; // Skip Anchor discriminator
      
      // Skip owner (32 bytes)
      offset += 32;
      
      // Parse last_ping (8 bytes at offset 32, little-endian)
      const lastPing = Number(
        new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getBigInt64(0, true)
      );
      offset += 8;
      
      // Parse ping_interval (8 bytes at offset 40, little-endian)  
      const pingInterval = Number(
        new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getBigInt64(0, true)
      );
      offset += 8;
      
      // Skip encrypted_data (512 bytes)
      offset += 512;
      
      // Parse data_length (2 bytes at offset 560, little-endian)
      const dataLength = new DataView(buffer.buffer, buffer.byteOffset + offset, 2).getUint16(0, true);
      offset += 2;
      
      // Parse created_at (8 bytes at offset 562, little-endian)
      const createdAt = Number(
        new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getBigInt64(0, true)
      );
      offset += 8;
      
      // Parse bump (1 byte at offset 570)
      const bump = new DataView(buffer.buffer, buffer.byteOffset + offset, 1).getUint8(0);
      
      return {
        lastPing,
        pingInterval,
        dataLength,
        createdAt,
        bump
      };
    }
    
    const switchData = parseDeadManSwitch(accountDataBuffer);
    
    // 3. Get current time (Unix timestamp in seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    
    // 4. Calculate expiration
    const expirationTime = switchData.lastPing + switchData.pingInterval;
    const isExpired = currentTime >= expirationTime;
    
    // 5. Log for debugging
    console.log('Switch Data:', {
      lastPing: switchData.lastPing,
      pingInterval: switchData.pingInterval,
      currentTime: currentTime,
      expirationTime: expirationTime,
      isExpired: isExpired
    });
    
    // 6. Return the result for Lit Protocol access control
    LitActions.setResponse({
      response: JSON.stringify({
        expired: isExpired,
        currentTime: currentTime,
        expirationTime: expirationTime,
        lastPing: switchData.lastPing,
        pingInterval: switchData.pingInterval
      })
    });
    
  } catch (error) {
    console.error('Error in Lit Action:', error);
    
    // On error, deny access by default
    LitActions.setResponse({
      response: JSON.stringify({
        expired: false,
        error: error.message
      })
    });
  }
};

go();