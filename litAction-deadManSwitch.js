/**
 * Lit Action for Dead Man Switch Expiration Check
 * 
 * This Lit Action checks if a Solana Dead Man Switch has expired
 * by fetching current account data and comparing last_ping + ping_interval
 * against current time.
 * 
 * Upload this file to IPFS and use the CID in access control conditions.
 */

const checkExpiry = async (switchPDA) => {
  try {
    // Fetch account data from Solana
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
      return false; // Account not found - deny access
    }

    // Parse the account data
    const accountDataBase64 = result.result.value.data[0];
    const accountDataBuffer = Uint8Array.from(atob(accountDataBase64), c => c.charCodeAt(0));
    
    // Parse according to DeadManSwitch struct layout:
    // discriminator: 8 bytes (0-7)
    // owner: Pubkey (32 bytes) (8-39)
    // last_ping: i64 (8 bytes) (40-47)
    // ping_interval: i64 (8 bytes) (48-55)
    
    let offset = 8; // Skip Anchor discriminator
    offset += 32;   // Skip owner (32 bytes) - now at offset 40
    
    // Parse last_ping (8 bytes, little-endian)
    const lastPing = Number(
      new DataView(accountDataBuffer.buffer, accountDataBuffer.byteOffset + offset, 8).getBigInt64(0, true)
    );
    offset += 8; // now at offset 48
    
    // Parse ping_interval (8 bytes, little-endian)  
    const pingInterval = Number(
      new DataView(accountDataBuffer.buffer, accountDataBuffer.byteOffset + offset, 8).getBigInt64(0, true)
    );
    
    // Calculate expiration: last_ping + ping_interval
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = lastPing + pingInterval;
    const isExpired = currentTime >= expirationTime;
    
    return isExpired;
    
  } catch (error) {
    return false; // Deny access on any error
  }
};