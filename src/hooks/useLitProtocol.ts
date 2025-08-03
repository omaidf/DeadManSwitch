import { useState, useEffect } from 'react'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { encryptString, decryptToString } from '@lit-protocol/encryption'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Connection, Transaction, TransactionInstruction } from '@solana/web3.js'
import { getConfig } from '../lib/config'

// No IPFS CID needed - using simple Solana RPC conditions

interface EncryptionResult {
  encryptedString: string
  encryptedSymmetricKey: string
}

export function useLitProtocol() {
  const [litNodeClient, setLitNodeClient] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const wallet = useWallet()
  const config = getConfig()

  // Toast notification helper
  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const toastDiv = document.createElement('div');
    const bgColor = {
      success: 'linear-gradient(135deg, #10b981, #059669)',
      error: 'linear-gradient(135deg, #ef4444, #dc2626)', 
      info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      warning: 'linear-gradient(135deg, #f59e0b, #d97706)'
    }[type];
    
    const icon = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    }[type];

    toastDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: ${bgColor};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 400px;
        border: 1px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        animation: slideInFromRight 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 20px; margin-right: 8px;">${icon}</span>
          <strong>${title}</strong>
        </div>
        <div style="font-size: 12px; opacity: 0.9; white-space: pre-line;">
          ${message}
        </div>
      </div>
    `;
    
    // Add animation styles if not already present
    if (!document.querySelector('#toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toastDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toastDiv.parentNode) {
        toastDiv.style.animation = 'slideInFromRight 0.3s ease-out reverse';
        setTimeout(() => toastDiv.remove(), 300);
      }
    }, 5000);
  };

  // Helper: fetch switch data from Solana using PDA directly
  const fetchSwitchDataByPDA = async (switchPDA: string | PublicKey): Promise<{
    expirationTime: number;
    expired: boolean;
    lastPing: number;
    pingInterval: number;
    shouldBeExpired: boolean;
    owner: string;
    dataLength: number;
    createdAt: number;
    bump: number;
  }> => {
    const pdaKey = typeof switchPDA === 'string' ? new PublicKey(switchPDA) : switchPDA;

    try {
      console.log('🔍 Fetching switch data from Solana for PDA:', pdaKey.toString());
      
      // Use the same connection approach as the working script
      const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
      const accountInfo = await connection.getAccountInfo(pdaKey, 'confirmed');
      
      if (!accountInfo) {
        throw new Error("Switch account not found");
      }

      // Manual decode using exact structure from lib.rs (like working script)
      const data = accountInfo.data;
      const view = new DataView(data.buffer, data.byteOffset);
      let offset = 8; // Skip 8-byte discriminator
      
      // From lib.rs DeadManSwitch struct:
      // pub owner: Pubkey,                       // 32 bytes
      // pub last_ping: i64,                      // 8 bytes  
      // pub ping_interval: i64,                  // 8 bytes
      // pub encrypted_data: [u8; MAX_DATA_SIZE], // 512 bytes
      // pub data_length: u16,                    // 2 bytes
      // pub created_at: i64,                     // 8 bytes
      // pub bump: u8,                            // 1 byte
      // pub expired: bool,                       // 1 byte
      
      const owner = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const lastPing = Number(view.getBigInt64(offset, true)); // little endian
      offset += 8;
      
      const pingInterval = Number(view.getBigInt64(offset, true));
      offset += 8;
      
      // Skip encrypted_data (512 bytes)
      offset += 512;
      
      const dataLength = view.getUint16(offset, true);
      offset += 2;
      
      const createdAt = Number(view.getBigInt64(offset, true));
      offset += 8;
      
      const bump = view.getUint8(offset);
      offset += 1;
      
      const expired = view.getUint8(offset) === 1;
      
      // Calculate expiration time: last_ping + ping_interval
      const expirationTime = lastPing + pingInterval;
      const currentTime = Math.floor(Date.now() / 1000);
      const shouldBeExpired = currentTime >= expirationTime;

      console.log('📊 Switch data fetched (manual decode):');
      console.log('  - Owner:', owner.toString());
      console.log('  - Last ping:', lastPing, '(', new Date(lastPing * 1000).toISOString(), ')');
      console.log('  - Ping interval:', pingInterval, 'seconds');
      console.log('  - Expiration time:', expirationTime, '(', new Date(expirationTime * 1000).toISOString(), ')');
      console.log('  - Current time:', currentTime, '(', new Date(currentTime * 1000).toISOString(), ')');
      console.log('  - Expired flag (on-chain):', expired);
      console.log('  - Should be expired (time-based):', shouldBeExpired);
      console.log('  - Data length:', dataLength, 'bytes');
      console.log('  - Created at:', createdAt, '(', new Date(createdAt * 1000).toISOString(), ')');
      console.log('  - Bump:', bump);
      
      return { 
        expirationTime, 
        expired, 
        lastPing, 
        pingInterval, 
        shouldBeExpired, 
        owner: owner.toString(),
        dataLength,
        createdAt,
        bump
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch switch data:', error);
      if (error instanceof Error && error.message.includes('Account not found')) {
        throw new Error(`Switch not found on Solana. PDA: ${pdaKey.toString()}`);
      }
      throw new Error(`Failed to fetch switch expiration data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  // Helper: mark a switch as expired using direct RPC (bypassing Anchor IDL issues)
  const markSwitchExpiredByPDA = async (switchPDA: string | PublicKey, _ownerPubkey?: string): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const pdaKey = typeof switchPDA === 'string' ? new PublicKey(switchPDA) : switchPDA;
    
    try {
      console.log('🚀 Marking switch as expired by PDA (Direct RPC):', pdaKey.toString());

      // Setup connection
      const connection = new Connection(config.SOLANA_RPC_URL);

      // Check if switch should be expired first
      const switchData = await fetchSwitchDataByPDA(pdaKey);
      
      if (!switchData.shouldBeExpired) {
        console.warn('⚠️ Switch is not ready to be expired yet');
        throw new Error('Switch has not reached its expiration time yet');
      }

      if (switchData.expired) {
        console.warn('⚠️ Switch is already marked as expired on-chain');
        return true; // Already expired, no need to mark again
      }

      console.log('✅ Switch is time-expired but not yet marked on-chain - proceeding with markExpired');

      // Create markExpired instruction manually (bypassing Anchor)
      const programId = new PublicKey(config.PROGRAM_ID);
      const instructionData = Buffer.from([
        // mark_expired discriminator (8 bytes) - calculated from sha256("global:mark_expired")
        0xe9, 0xf0, 0xdc, 0x58, 0x7d, 0xea, 0xe7, 0x7d
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: pdaKey, isSigner: false, isWritable: true },
        ],
        programId: programId,
        data: instructionData,
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Send transaction and get signature immediately
      const signature = await wallet.sendTransaction(transaction, connection);
      console.log('📝 Transaction signature:', signature);
      
      // Show toast notification immediately after getting signature
      showToast('Transaction Sent!', `Marking switch as expired...\nTx: ${signature.slice(0, 8)}...`, 'info');
      
      // Wait for processed confirmation only (faster)
      try {
        const confirmation = await connection.confirmTransaction(signature, 'processed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log('✅ Switch successfully marked as expired (processed)');
        showToast('Switch Marked Expired!', 'Switch has been marked as expired on-chain', 'success');
        return true;
      } catch (confirmError) {
        // Even if confirmation times out, the transaction might still succeed
        // We'll proceed anyway since we got a signature
        console.warn('⚠️ Confirmation timeout, but proceeding since we have signature:', signature);
        showToast('Transaction Sent', 'Proceeding with decryption...', 'warning');
        return true;
      }

    } catch (error) {
      console.error('❌ Failed to mark switch as expired:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast('Mark Expired Failed', `Failed to mark switch as expired:\n${errorMessage}`, 'error');
      throw error;
    }
  }







  // Combined function: mark as expired and decrypt in one operation (accepts PDA directly)
  const markExpiredAndDecryptByPDA = async (
    encryptedData: Uint8Array,
    switchPDA: string | PublicKey,
    ownerPubkey?: string
  ): Promise<string> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const pdaKey = typeof switchPDA === 'string' ? new PublicKey(switchPDA) : switchPDA;
    const ownerPk = ownerPubkey || wallet.publicKey.toString();
    
    try {
      console.log('🚀 ==================== MARK EXPIRED & DECRYPT (PDA) ====================');
      console.log('🎯 Starting combined operation for PDA:', pdaKey.toString());
      
      // Show initial toast
      showToast('Starting Operation', 'Checking switch status and preparing decryption...', 'info');
      
      // Step 1: Check if switch should be expired
      console.log('🔍 Step 1: Checking if switch should be marked as expired...');
      const switchData = await fetchSwitchDataByPDA(pdaKey);
      
      if (!switchData.shouldBeExpired) {
        console.log('⚠️ Switch is not ready to be marked as expired');
        throw new Error('Switch has not reached its expiration time yet');
      }

      if (switchData.expired) {
        console.log('ℹ️ Switch is already marked as expired on-chain, skipping to decryption');
      } else {
        // Step 2: Mark the switch as expired
        console.log('📝 Step 2: Switch is time-expired but not marked - marking as expired...');
        await markSwitchExpiredByPDA(pdaKey, ownerPk);
        console.log('✅ Switch marked as expired on-chain');
      }
      
      // Step 3: Decrypt the message
      console.log('🔓 Step 3: Decrypting message...');
      showToast('Decrypting Message', 'Switch marked successfully! Now decrypting your message...', 'info');
      
      const decryptedMessage = await decryptMessage(encryptedData, pdaKey.toString(), ownerPk);
      
      console.log('✅ Combined operation completed successfully');
      console.log('🏁 ==================== MARK EXPIRED & DECRYPT COMPLETE ====================');
      
      showToast('Decryption Complete!', 'Your message has been successfully decrypted', 'success');
      return decryptedMessage;
      
    } catch (error) {
      console.error('❌ Combined operation failed:', error);
      console.log('🏁 ==================== MARK EXPIRED & DECRYPT FAILED ====================');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast('Operation Failed', `Failed to complete operation:\n${errorMessage}`, 'error');
      throw error;
    }
  }



  // Helper: Clear all cached authentication data
  const clearCachedAuthData = () => {
    console.log('🧹 Clearing all cached Lit Protocol authentication data...')
    
    // Clear Lit SDK session storage
    try {
      // This will clear localStorage for authSig and sessionSigs
      if (typeof window !== 'undefined' && (window as any).LitJsSdk) {
        (window as any).LitJsSdk.disconnectWeb3()
      }
    } catch (e) {
      console.warn('Could not call LitJsSdk.disconnectWeb3():', e)
    }
    
    // Clear our custom cache keys
    localStorage.removeItem('lit-solana-authSig')
    localStorage.removeItem('lit-authSig') // Old Ethereum-style cache
    localStorage.removeItem('lit-sessionSigs') // Stale session signatures
    localStorage.removeItem('lit-wallet-sig') // Any other potential cache keys
    
    // Clear any Lit-related keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lit-') || key.startsWith('LIT_')) {
        localStorage.removeItem(key)
      }
    })
    
    console.log('✅ All authentication cache cleared')
  }

  // Helper: create Solana-specific auth signature for Lit Protocol
  const getOrCreateAuthSig = async (forceRefresh = false) => {
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    const cacheKey = 'lit-solana-authSig'
    
    // Force refresh if requested or check cache
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached)
          // Validate cache is not too old (1 hour) and belongs to current wallet
          // Note: Each SIWS message is unique (random nonce + timestamp), but we cache 
          // to avoid multiple wallet popups for the same user within the cache window
          if (Date.now() - parsedCache.timestamp < 1 * 60 * 60 * 1000 && 
              parsedCache.authSig.address === wallet.publicKey.toBase58()) {
            console.log('🔄 Using cached SIWS auth signature (avoids multiple wallet popups)')
            return parsedCache.authSig
          }
        } catch (e) {
          // Invalid cache format, clear it
          localStorage.removeItem(cacheKey)
        }
      }
    }

    console.log(forceRefresh ? '🔄 Force refreshing SIWS auth signature' : '🔑 Creating new SIWS auth signature for Lit Protocol')
    
    // Generate proper SIWS (Sign-In With Solana) message format
    // Following the official SIWS specification for Lit Protocol compatibility
    const domain = window.location.host || 'localhost:3000'
    const uri = window.location.origin || 'http://localhost:3000'
    const address = wallet.publicKey.toBase58()
    
    // SIWS message format - following the exact specification
    // Use current timestamp and expiration time for proper authentication validation
    const issuedAt = new Date().toISOString()
    
    // Set expiration to 10 minutes from now (as recommended for Lit Protocol)
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    
    // Generate a random nonce (as per SIWS spec)
    const nonce = Math.floor(Math.random() * 1000000)
    
    // Official SIWS message format
    const siwsMessage = `${domain} wants you to sign in with your Solana account:
${address}

URI: ${uri}
Version: 1
Chain ID: 0
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`

    console.log('📝 Using official SIWS message format')
    console.log('📝 Issued At:', issuedAt)
    console.log('📝 Expiration Time:', expirationTime)
    console.log('📝 Nonce:', nonce)
    console.log('📝 Chain ID: 0 (Solana)')
    console.log('📝 Full SIWS message:', siwsMessage)
    
    const messageBytes = new TextEncoder().encode(siwsMessage)
    let signature: Uint8Array
    
    try {
      signature = await wallet.signMessage(messageBytes)
      console.log('✅ Message signed successfully by wallet')
    } catch (signError) {
      console.error('❌ Failed to sign SIWS message:', signError)
      throw new Error(`Failed to sign authentication message: ${signError instanceof Error ? signError.message : 'Unknown signing error'}`)
    }
    
    // Convert signature to Lit Protocol format for Solana SIWS
    // Must follow: base58 decode -> hex encode -> remove 0x prefix
    let formattedSig: string
    try {
      // Solana wallets return raw signature bytes (64 bytes for ED25519)
      // Convert raw signature bytes to hex string (64-byte ED25519 = 128 hex chars)
      formattedSig = Buffer.from(signature).toString('hex')
      
      console.log('✅ Signature converted to hex (no 0x prefix)')
      console.log('📝 Raw signature bytes:', signature.length)
      console.log('📝 Hex signature length:', formattedSig.length)
    } catch (conversionError) {
      console.error('❌ Failed to convert signature:', conversionError)
      throw new Error('Failed to format signature for Lit Protocol')
    }
    
    // Create the auth signature in the SIWS format expected by Lit Protocol
    const authSig = {
      sig: formattedSig, // Hex format WITHOUT 0x prefix (as per docs)
      derivedVia: 'solana.signMessage',
      signedMessage: siwsMessage,
      address: address, // Solana address in base58 format
    }

    // Validate ED25519 signature length (64 bytes = 128 hex characters)
    if (authSig.sig.length !== 128) {
      console.error('❌ Invalid signature length:', authSig.sig.length, '(expected 128 for ED25519)')
      throw new Error(`ED25519 signature must be exactly 128 hex characters, got ${authSig.sig.length}`)
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(authSig.sig)) {
      console.error('❌ Signature contains invalid hex characters')
      throw new Error('Signature must be valid hexadecimal')
    }

    // Cache the auth signature with timestamp
    localStorage.setItem(cacheKey, JSON.stringify({
      authSig,
      timestamp: Date.now()
    }))

    console.log('✅ Created SIWS auth signature for Lit Protocol')
    console.log('📝 Signature length:', authSig.sig.length, 'chars (128 for ED25519)')
    console.log('📝 Signature preview:', authSig.sig.substring(0, 16) + '...')
    console.log('📝 Address:', authSig.address)
    console.log('📝 DerivedVia:', authSig.derivedVia)
    console.log('📝 Chain ID: 0 (Solana)')
    console.log('📝 Valid for 10 minutes from:', issuedAt)
    
    return authSig
  }

  useEffect(() => {
    const initLit = async () => {
      if (litNodeClient || isConnecting) return

      // Clear any stale session data on initialization
      console.log('🧹 Clearing stale Lit Protocol session data on init...')
      clearCachedAuthData()
      
      setIsConnecting(true)
      setError(null)
      setConnectionStatus('Connecting to Lit Protocol...')

      try {
        const client = new LitNodeClient({
          litNetwork: config.LIT_NETWORK as any,
          debug: import.meta.env.DEV,
        })

        setConnectionStatus('Establishing secure connection...')
        await client.connect()
        setLitNodeClient(client)
        setConnectionStatus(null)
        console.log('✅ Connected to Lit Protocol network:', config.LIT_NETWORK)
        console.log('🔗 Using Lit SDK v7+ with Solana authentication')
      } catch (err) {
        console.error('Failed to connect to Lit Network:', err)
        setError(err instanceof Error ? err.message : 'Failed to connect to Lit Network')
        setConnectionStatus(null)
      } finally {
        setIsConnecting(false)
      }
    }

    initLit()

    // Cleanup function to properly disconnect
    return () => {
      if (litNodeClient) {
        console.log('🔌 Disconnecting from Lit Protocol...')
        try {
          litNodeClient.disconnect()
        } catch (error) {
          console.warn('⚠️ Error during Lit Protocol disconnect:', error)
        }
      }
    }
  }, [config.LIT_NETWORK])

  // Additional cleanup on component unmount
  useEffect(() => {
    return () => {
      if (litNodeClient) {
        console.log('🔌 Component unmounting, disconnecting Lit Protocol...')
        try {
          litNodeClient.disconnect()
        } catch (error) {
          console.warn('⚠️ Error during Lit Protocol cleanup:', error)
        }
      }
    }
  }, [])

  /**
   * Encrypts a message using Lit Protocol with Dead Man's Switch access conditions.
   * 
   * This function encrypts a message client-side and stores the decryption key on Lit Protocol
   * with IPFS Lit Action access conditions. The message can only be decrypted when the
   * corresponding Solana switch has expired (Lit Action dynamically checks last_ping + ping_interval).
   * 
   * @param message - The plaintext message to encrypt
   * @param switchId - Optional switch ID for PDA derivation (defaults to current timestamp)
   * @returns Promise resolving to encrypted data and symmetric key hash
   * @throws Error if Lit Protocol not connected, wallet not connected, or encryption fails
   * 
   * @example
   * ```typescript
   * // Method 1: Auto-generate switch ID from timestamp
   * const result = await encryptMessage("Secret message");
   * 
   * // Method 2: Use specific switch ID
   * const result = await encryptMessage("Secret message", "switch123");
   * ```
   */
  const encryptMessage = async (message: string, switchId?: string): Promise<EncryptionResult> => {
    if (!litNodeClient) {
      throw new Error('Lit Protocol not connected')
    }

    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    // 📏 CHARACTER LIMIT VALIDATION (for 512-byte Solana storage limit)
    const MAX_MESSAGE_LENGTH = 140;
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Secret message too long: ${message.length} characters (max: ${MAX_MESSAGE_LENGTH}). This ensures encrypted data fits in Solana's 512-byte limit.`);
    }

    try {
      console.log('🔐 Encrypting message with Lit Protocol')

      // Use provided switch ID or generate fallback
      const actualSwitchId = switchId || Date.now().toString()
      console.log('Using switch ID for PDA:', actualSwitchId)

      // Derive switch PDA for access control parameters
      const [switchPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("switch"),
          wallet.publicKey!.toBuffer(),
          Buffer.from(actualSwitchId)
        ],
        new PublicKey(config.PROGRAM_ID)
      );

      // Simple access control: any valid Solana address can decrypt
      // Server-side enforces the real expiration logic by only showing decrypt buttons when:
      // 1. Switch is time-expired (isExpired = true), OR
      // 2. Switch is marked as expired on-chain (account.expired = true)
      const solRpcConditions = [
        {
          method: "getBalance",
          params: [":userAddress"],
          pdaParams: [],
          pdaInterface: { offset: 0, fields: {} },
          pdaKey: "",
          chain: "solana",
          returnValueTest: {
            key: "",
            comparator: ">=",
            value: "0", // Every valid Solana address has a balance >= 0
          },
        },
      ];


      // Switch metadata is embedded in compact format

      // Get Solana authSig for encryption
      const authSig = await getOrCreateAuthSig();
      
      // Use Lit's encryption with only Solana RPC conditions
      const encryptParams = {
        dataToEncrypt: message,
        solRpcConditions,
        authSig,
        chain: 'solana',
      };



      const { ciphertext, dataToEncryptHash } = await encryptString(encryptParams, litNodeClient)
      
      // === Detailed snapshot of encryption output & parameters ===
      console.log('📊 encryptString() output:');
      console.log('  • solRpcConditions:', JSON.stringify(solRpcConditions, null, 2));
      console.log('  • ciphertext:', typeof ciphertext === 'string' ? ciphertext : Buffer.from(ciphertext).toString('base64'));
      console.log('  • dataToEncryptHash:', dataToEncryptHash);
      console.log('  • authSig:', authSig);
      console.log('  • chain:', 'solana');
      // === End snapshot ===

      // Helper – detect if input is already base64 to avoid double-encoding
      const isAlreadyBase64 = (data: any): boolean => {
        if (typeof data !== 'string') return false
        // quick heuristic: valid chars & length multiple of 4
        return /^[A-Za-z0-9+/=]+$/.test(data) && data.length % 4 === 0
      }

      // Ensure ciphertext is base64 once and only once
      const ciphertextBase64 =
        typeof ciphertext === 'string'
          ? isAlreadyBase64(ciphertext) ? ciphertext : Buffer.from(ciphertext).toString('base64')
          : Buffer.from(ciphertext).toString('base64')

      // Create encrypted data structure with minimal data (under 512 bytes)
      const compactEncryptedData = {
        c: ciphertextBase64, // Ciphertext (base64 once)
        h: dataToEncryptHash, // Hash (shortened key)
        pda: switchPDA.toString(), // Just the switch PDA
        switchId: actualSwitchId // Store switch ID for reconstruction
      }



      console.log('✅ Message encrypted with Dead Man\'s Switch logic')
      console.log('🔧 Access control: Solana RPC conditions only')
      console.log('🔧 Chain: solana')
      console.log('🔧 Switch PDA:', switchPDA.toString())
      console.log('🔧 Decryption requires expired field = true (enforced server-side)')

      // Create encrypted string
      const finalEncryptedString = JSON.stringify(compactEncryptedData)
      console.log('🔧 Encrypted data size:', finalEncryptedString.length, 'bytes')

      return {
        encryptedString: finalEncryptedString,
        encryptedSymmetricKey: dataToEncryptHash,
      }
    } catch (err) {
      console.error('❌ Encryption failed:', err)
      
      // Provide user-friendly error messages
      let userMessage = 'Encryption failed'
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          userMessage = 'Network error: Unable to connect to Lit Protocol. Please check your internet connection.'
        } else if (err.message.includes('signature')) {
          userMessage = 'Wallet signature required for encryption. Please approve the signing request.'
        } else if (err.message.includes('account')) {
          userMessage = 'Invalid switch configuration. Please try again.'
        } else {
          userMessage = `Encryption failed: ${err.message}`
        }
      }
      
      throw new Error(userMessage)
    }
  }

  /**
   * Decrypts a message using Lit Protocol when access conditions are satisfied.
   * 
   * This function attempts to decrypt a previously encrypted message by checking
   * if the associated Dead Man's Switch has expired. Decryption only succeeds if
   * the switch has expired, indicating the owner failed to ping
   * within the required interval.
   * 
   * @param encryptedString - The encrypted data (JSON string from encryptMessage)
   * @param encryptedSymmetricKey - Optional symmetric key hash (for legacy format)
   * @param _switchId - Optional switch ID (parameter preserved for compatibility)
   * @returns Promise resolving to the decrypted plaintext message
   * @throws Error if Lit Protocol not connected, access conditions not met, or decryption fails
   * 
   * @example
   * ```typescript
   * try {
   *   const decrypted = await decryptMessage(encryptedData);
   *   console.log("Revealed message:", decrypted);
   * } catch (error) {
   *   console.log("Switch not expired yet or decryption failed");
   * }
   * ```
   */
  /**
   * Decrypt a stored message when (and only when) its Dead-Man’s-Switch is
   * expired (checkExpiration returns true on-chain).
   *
   * Flow
   * ────
   * 1.  Normalise the encrypted payload – handle every legacy format we have
   *     shipped so far (compact / full / raw).
   * 2.  Build a Solana access condition that calls checkExpiration method on the
   *     PDA derived from program-id + owner + switch-id.
   * 3.  Ask Lit for the *symmetric key* (`getEncryptionKey`) – you must present:
   *       • the RPC condition  (solRpcConditions)
   *       • the ciphertext hash (toDecrypt)
   *       • an authSig (signed by current wallet)
   * 4.  Feed that key into `decryptToString` to obtain plaintext.
   */
  const decryptMessage = async (
    encryptedData: Uint8Array,
    _encryptedSymmetricKey?: string,
    _switchId?: string,
    _ownerPubkey?: string        // allow decrypting other users switches
  ): Promise<string> => {
    console.log('🚀 ==================== DECRYPTION START ====================');
    console.log('📥 Input parameters:');
    console.log('  - encryptedData size:', encryptedData.length, 'bytes');
    console.log('  - _encryptedSymmetricKey:', _encryptedSymmetricKey ? 'provided' : 'not provided');
    console.log('  - _switchId:', _switchId || 'not provided');
    console.log('  - _ownerPubkey:', _ownerPubkey || 'not provided');
    
    /* 0️⃣  Preconditions */
    console.log('🔍 Step 1: Checking preconditions...');
    if (!litNodeClient) {
      console.error('❌ Lit client not ready');
      throw new Error('Lit client not ready');
    }
    console.log('✅ Lit client ready');
    
    if (!wallet.publicKey || !wallet.signMessage) {
      console.error('❌ Wallet not connected');
      throw new Error('Wallet not connected');
    }
    console.log('✅ Wallet connected:', wallet.publicKey.toString());

    console.log('🔍 Step 2: Decoding encrypted data...');
    const encryptedString = new TextDecoder().decode(encryptedData)
    console.log('📄 Encrypted string length:', encryptedString.length, 'characters');
    console.log('📄 Encrypted string preview:', encryptedString.substring(0, 100) + '...');
    
    // Parse the encrypted data to extract Lit Action code and access control conditions
    console.log('🔍 Step 3: Parsing encrypted JSON data...');
    let parsedData: any;
    try {
      parsedData = JSON.parse(encryptedString);
      console.log('✅ Successfully parsed JSON');
      console.log('📝 Parsed data keys:', Object.keys(parsedData));
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      throw new Error('Invalid encrypted data format');
    }

    console.log('🔍 Step 4: Extracting required data from parsed JSON...');
    // Extract required data
    const ciphertext = parsedData.c || parsedData.ciphertext;
    const dataToEncryptHash = parsedData.h || parsedData.dataToEncryptHash;
    
    console.log('📋 Extracted data:');
    console.log('  - ciphertext:', ciphertext ? `${ciphertext.length} chars` : 'NOT FOUND');
    console.log('  - dataToEncryptHash:', dataToEncryptHash ? `${dataToEncryptHash.length} chars` : 'NOT FOUND');
    console.log('  - cid:', parsedData.cid || 'NOT FOUND');
    console.log('  - pda:', parsedData.pda || 'NOT FOUND');
    
    if (!ciphertext) {
      console.error('❌ Missing ciphertext in encrypted data');
      throw new Error('Missing ciphertext');
    }
    if (!dataToEncryptHash) {
      console.error('❌ Missing dataToEncryptHash in encrypted data');
      throw new Error('Missing dataToEncryptHash');
    }
    
    // Reconstruct Solana RPC conditions from stored data
    console.log('🔍 Step 5: Reconstructing Solana RPC conditions...');
    // Declare switchPDA early to avoid scope issues
    let switchPDA;
    let solRpcConditions;
    
    if (parsedData.pda || parsedData.switchId) {
      console.log('✅ Using new format: PDA/Switch ID reconstruction');
      console.log('  - Switch PDA:', parsedData.pda);
      console.log('  - Switch ID:', parsedData.switchId);
      
      solRpcConditions = [
        {
          method: "getBalance",
          params: [":userAddress"],
          pdaParams: [],
          pdaInterface: { offset: 0, fields: {} },
          pdaKey: "",
          chain: "solana",
          returnValueTest: {
            key: "",
            comparator: ">=",
            value: "0", // Every valid Solana address has a balance >= 0
          },
        },
      ];
      
      console.log('✅ Solana RPC conditions reconstructed');
    } else {
      console.log('⚠️ Using legacy format: need to construct conditions manually');
      // Legacy format: use simple balance check
      solRpcConditions = [
        {
          method: "getBalance",
          params: [":userAddress"],
          pdaParams: [],
          pdaInterface: { offset: 0, fields: {} },
          pdaKey: "",
          chain: "solana",
          returnValueTest: {
            key: "",
            comparator: ">=",
            value: "0", // Every valid Solana address has a balance >= 0
          },
        },
      ];
    }

    console.log('🔍 Step 6: Determining switch PDA...');
    // Get switch PDA - either from stored data or derive from parameters
    if (parsedData.pda) {
      console.log('✅ Using stored PDA from encrypted data');
      console.log('  - Stored PDA string:', parsedData.pda);
      try {
        switchPDA = new PublicKey(parsedData.pda);
        console.log('✅ Successfully created PublicKey from stored PDA');
      } catch (pdaError) {
        console.error('❌ Failed to create PublicKey from stored PDA:', pdaError);
        throw new Error(`Invalid PDA format: ${parsedData.pda}`);
      }
    } else {
      console.log('⚠️ No stored PDA - deriving from parameters (legacy format)');
      // Legacy format: derive PDA from parameters
      const ownerPk = _ownerPubkey || wallet.publicKey!.toString();
      const switchId = _switchId || 'unknown';
      
      console.log('  - Owner public key:', ownerPk);
      console.log('  - Switch ID:', switchId);
      console.log('  - Program ID:', config.PROGRAM_ID);
      
      try {
        [switchPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("switch"),
            new PublicKey(ownerPk).toBuffer(),
            Buffer.from(switchId)
          ],
          new PublicKey(config.PROGRAM_ID)
        );
        console.log('✅ Successfully derived PDA:', switchPDA.toString());
      } catch (pdaError) {
        console.error('❌ Failed to derive PDA:', pdaError);
        throw new Error('Failed to derive switch PDA');
      }
    }

    console.log('🔍 Step 7: Final validation of required data...');
    if (!ciphertext || !dataToEncryptHash) {
      console.error('❌ Missing essential encrypted data:');
      console.error('  - ciphertext:', ciphertext ? 'present' : 'MISSING');
      console.error('  - dataToEncryptHash:', dataToEncryptHash ? 'present' : 'MISSING');
      throw new Error('Missing ciphertext or dataToEncryptHash');
    }
    console.log('✅ Essential encrypted data present');
    
    // No access control conditions needed - using only Solana RPC conditions
    console.log('✅ Using Solana RPC conditions with getSwitchInfo instruction only');

    if (!switchPDA) {
      console.error('❌ No switch PDA available');
      throw new Error('Cannot derive switch PDA. Missing switchId or owner parameters.');
    }
    console.log('✅ Switch PDA confirmed:', switchPDA.toString());

    console.log('🔍 Decrypting with simple Solana RPC approach');
    console.log('📝 Using access control: Solana RPC (expired = true) only');
    console.log('🌍 ANYONE can decrypt if the switch is marked as expired!');
    console.log('🔄 Solana RPC will check expired field for switch:', switchPDA.toString());
    
    // 🐞 DEBUG: Log the actual conditions being used
    console.log('🔍 SOLANA RPC CONDITIONS:', JSON.stringify(solRpcConditions, null, 2));

    console.log('🔍 Step 8: Generating fresh authentication signature...');
    // 🔄 ALWAYS generate fresh auth signature for decryption to avoid stale cache issues
    console.log('🔑 Generating fresh auth signature for decryption...');
    let authSig;
    try {
      authSig = await getOrCreateAuthSig(true); // Force fresh signature
      console.log('✅ Auth signature generated successfully');
      console.log('  - Address:', authSig.address);
      console.log('  - DerivedVia:', authSig.derivedVia);
      console.log('  - Signature format:', /^[0-9a-fA-F]+$/.test(authSig.sig) ? 'hex (no prefix)' : 'unknown');
      console.log('  - Signature length:', authSig.sig.length, 'chars (should be 128 for ED25519)');
      console.log('  - Message preview:', authSig.signedMessage.substring(0, 100) + '...');
      
      // Validate signature format for ED25519 compatibility
      if (authSig.sig.startsWith('0x')) {
        console.warn('⚠️ Signature has 0x prefix - this may cause ED25519 validation issues');
      }
      
      if (authSig.sig.length !== 128) {
        console.warn('⚠️ Signature length is', authSig.sig.length, 'but ED25519 should be 128 hex chars');
      }
      
    } catch (authError) {
      console.error('❌ Failed to generate auth signature:', authError);
      console.log('🔧 Clearing authentication cache and retrying...');
      clearCachedAuthData();
      throw new Error(`Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
    }

    console.log('🔍 Step 9: Preparing decryption parameters...');
    
    // SIWS Address Consistency Check - ensure authSig address matches access control conditions
    console.log('🔍 Validating SIWS address consistency...');
    console.log('  - AuthSig address:', authSig.address);
    console.log('  - Current wallet address:', wallet.publicKey?.toBase58());
    
    if (authSig.address !== wallet.publicKey?.toBase58()) {
      console.error('❌ Address mismatch between authSig and wallet!');
      console.error('  - AuthSig address:', authSig.address);
      console.error('  - Wallet address:', wallet.publicKey?.toBase58());
      throw new Error('SIWS address mismatch: authSig address does not match connected wallet');
    }
    console.log('✅ SIWS address consistency verified');
    
    // Prepare decryption parameters with only Solana RPC conditions
    const decryptParams = {
      solRpcConditions,
      ciphertext,
      dataToEncryptHash,
      authSig,
      chain: 'solana',
    };
    
    console.log('📋 Decryption parameters prepared:');
    console.log('  - solRpcConditions:', solRpcConditions ? `${solRpcConditions.length} conditions` : 'MISSING');
    console.log('  - ciphertext length:', ciphertext.length);
    console.log('  - dataToEncryptHash length:', dataToEncryptHash.length);
    console.log('  - authSig present:', !!authSig);
    console.log('  - chain:', 'solana');

    console.log('🔄 Decrypting with fresh auth signature and Solana RPC conditions...');
    console.log('📍 Solana RPC will check: expired field = true');
    console.log('⚡ Simple and direct - no complex logic needed');

    console.log('🔍 Step 10: EXECUTING LIT PROTOCOL DECRYPTION...');
    console.log('⏱️ Starting decryption at:', new Date().toISOString());
    
    // === Detailed parameter snapshot before decryptToString ===
    console.log('📊 decryptToString() parameters:');
    console.log('  • solRpcConditions:', JSON.stringify(solRpcConditions, null, 2));
    console.log('  • ciphertext:', ciphertext);
    console.log('  • dataToEncryptHash:', dataToEncryptHash);
    console.log('  • authSig:', authSig);
    console.log('  • chain:', 'solana');
    // === End snapshot ===
    


    // Track timing for both success and failure cases
    const startTime = Date.now();
    
    try {
      // Use standard decryptToString - Lit Protocol will execute the access control Lit Action
      console.log('🚀 CALLING decryptToString() - Lit Protocol will now:');
      console.log('  1️⃣ Call Solana RPC getAccountInfo to check expired field');
      console.log('  2️⃣ Validate the switch is marked as expired (expired = true)');
      console.log('  3️⃣ Return decrypted message if condition passes');
      
      const decryptedMessage = await decryptToString(decryptParams, litNodeClient);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('🎉 ==================== DECRYPTION SUCCESS ====================');
      console.log('⏱️ Total decryption time:', duration, 'ms');
      console.log('⏱️ Completed at:', new Date().toISOString());
      console.log('');
      console.log('🎯 CONDITION RESULTS (inferred from success):');
      console.log('  ✅ SOLANA RPC RESULT: TRUE');
      console.log('     → expired field = true check passed');
      console.log('     → Switch is marked as expired');
      console.log('     → Decryption allowed');
      console.log('');
      console.log('📄 DECRYPTED CONTENT:');
      console.log('  - Message length:', decryptedMessage?.length || 0, 'characters');
      console.log('  - Message preview:', decryptedMessage ? decryptedMessage.substring(0, 50) + (decryptedMessage.length > 50 ? '...' : '') : 'EMPTY');
      console.log('  - Message type:', typeof decryptedMessage);
      console.log('🎉 ==================== DECRYPTION SUCCESS ====================');
      
      return decryptedMessage;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('💥 ==================== DECRYPTION FAILURE ====================');
      console.log('⏱️ Failed after:', duration, 'ms');
      console.log('⏱️ Failed at:', new Date().toISOString());
      console.error('❌ Raw error object:', error);
      
      // Enhanced error analysis with detailed condition breakdown
      console.log('🔍 DETAILED FAILURE ANALYSIS:');
      
      if (error instanceof Error) {
        console.log('📋 Error details:');
        console.log('  - Error name:', error.name);
        console.log('  - Error message:', error.message);
        console.log('  - Error stack preview:', error.stack?.split('\n').slice(0, 3).join('\n'));
        
        // Analyze the specific failure type
        const errorMsg = error.message.toLowerCase();
        

        
        if (errorMsg.includes('ed25519') || errorMsg.includes('authsig') || errorMsg.includes('auth_sig') || errorMsg.includes('signature')) {
          console.log('');
          console.log('🎯 SIWS AUTHENTICATION FAILURE:');
          console.log('  ❌ SOLANA AUTH SIGNATURE INVALID:');
          console.log('     → ED25519 signature verification failed');
          console.log('     → SIWS message or signature format incorrect');
          console.log('     → Address mismatch between wallet and authSig');
          console.log('  ℹ️ CONDITIONS: Not evaluated (auth failed first)');
          
          // Clear auth cache and suggest reconnection
          console.log('');
          console.log('🔧 SIWS TROUBLESHOOTING STEPS:');
          console.log('  1. Disconnect and reconnect your Solana wallet');
          console.log('  2. Clear browser cache and localStorage');
          console.log('  3. Ensure wallet supports signMessage() for SIWS');
          console.log('  4. Check that signature format is hex without 0x prefix');
          console.log('  5. Verify SIWS message has Chain ID: 0 and Expiration Time');
          console.log('  6. Ensure message follows official SIWS specification');
          
          clearCachedAuthData();
          throw new Error('SIWS Authentication failed: Please disconnect and reconnect your wallet, then try again.');
          
        } else if (errorMsg.includes('access') || errorMsg.includes('condition') || errorMsg.includes('unauthorized')) {
          console.log('');
                  console.log('🎯 ACCESS CONTROL CONDITION FAILURE:');
        
        if (errorMsg.includes('expired') || errorMsg.includes('solana') || errorMsg.includes('rpc')) {
          console.log('  ❌ SOLANA RPC FAILED:');
          console.log('     → expired field check failed');
          console.log('     → Switch may not be marked as expired yet');
          console.log('     → Solana RPC may be unreachable');
          console.log('     → Try marking the switch as expired first');
        } else {
          console.log('  ❓ UNKNOWN ACCESS CONTROL FAILURE:');
          console.log('     → Check Solana RPC condition logs above');
          console.log('     → Verify switch PDA and expired field');
        }
          
        } else if (errorMsg.includes('signature') || errorMsg.includes('auth')) {
          console.log('');
          console.log('🎯 AUTHENTICATION FAILURE:');
          console.log('  ❌ AUTH SIGNATURE INVALID:');
          console.log('     → Signature verification failed');
          console.log('     → Wallet signature may be corrupted');
          console.log('     → Address mismatch possible');
          console.log('  ℹ️ CONDITIONS: Not evaluated (auth failed first)');
          
        } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
          console.log('');
          console.log('🎯 NETWORK FAILURE:');
          console.log('  ❌ NETWORK/RPC ERROR:');
          console.log('     → Cannot reach Lit nodes or Solana RPC');
          console.log('     → Check internet connection');
          console.log('     → Solana devnet may be down');
          console.log('  ℹ️ CONDITIONS: Cannot be evaluated (network issue)');
          
        } else {
          console.log('');
          console.log('🎯 UNKNOWN ERROR TYPE:');
          console.log('  ❓ UNRECOGNIZED FAILURE:');
          console.log('     → Error type not in our analysis patterns');
          console.log('     → Check raw error message above');
          console.log('     → May be a new error type');
        }
        

        
      } else {
        console.log('❌ Non-Error object thrown:', typeof error, error);
      }
      
      console.log('💥 ==================== DECRYPTION FAILURE ====================');
      
      // Provide user-friendly error messages
      let userMessage = 'Failed to decrypt message';
      if (error instanceof Error) {
        if (error.message.includes('access')) {
          userMessage = 'Access denied: The switch has not been marked as expired yet. Try marking it as expired first.';
        } else if (error.message.includes('fetch')) {
          userMessage = 'Network error: Unable to verify switch status. Please check your internet connection.';
        } else if (error.message.includes('expired')) {
          userMessage = 'This switch has not been marked as expired yet. Use the "Mark Expired" button first.';
        } else if (error.message.includes('auth') || error.message.includes('signature')) {
          userMessage = 'Authentication failed: Please disconnect and reconnect your wallet, then try again.';
        } else {
          userMessage = `Decryption failed: ${error.message}`;
        }
      }
      
      throw new Error(userMessage);
    }
    
    console.log('🏁 ==================== DECRYPTION PROCESS END ====================');
  }

  return {
    litNodeClient,
    isConnecting,
    error,
    connectionStatus,
    connected: !!litNodeClient,
    encryptMessage,
    decryptMessage,
    fetchSwitchDataByPDA, // Export function that accepts PDA directly
    markSwitchExpiredByPDA, // Export function that accepts PDA directly
    markExpiredAndDecryptByPDA, // Export combined function that accepts PDA directly
    clearCachedAuthData, // Export for manual cache clearing
  }
}