import { useState, useEffect } from 'react'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { encryptString, decryptToString } from '@lit-protocol/encryption'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { getConfig } from '../lib/config'

interface EncryptionResult {
  encryptedString: string
  encryptedSymmetricKey: string
}

/**
 * Custom React hook for integrating with Lit Protocol encryption services.
 * 
 * Provides client-side encryption and decryption capabilities using Lit Protocol's
 * decentralized network. Handles:
 * - Connection to Lit Protocol network
 * - Message encryption with Solana-based access conditions
 * - Message decryption when access conditions are met
 * - Dead man's switch specific logic for time-based access control
 * 
 * The hook automatically connects to the configured Lit Protocol network and
 * manages connection state, errors, and cleanup.
 * 
 * @returns Object containing Lit client, connection state, and encryption functions
 */
export function useLitProtocol() {
  const [litNodeClient, setLitNodeClient] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null)
  const wallet = useWallet()
  const config = getConfig()

  // Helper: fetch switch data from Solana and calculate expiration time
  const fetchSwitchExpirationTime = async (switchId: string, ownerPubkey?: string): Promise<number> => {
    const ownerPk = ownerPubkey || wallet.publicKey!.toString();
    
    // Derive the PDA address for the switch
    const [switchPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("switch"),
        new PublicKey(ownerPk).toBuffer(),
        Buffer.from(switchId)
      ],
      new PublicKey(config.PROGRAM_ID)
    );

    try {
      console.log('🔍 Fetching switch data from Solana for PDA:', switchPDA.toString());
      
      // Fetch account data from Solana
      const response = await fetch("https://api.devnet.solana.com", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [switchPDA.toString(), { encoding: "base64", commitment: "confirmed" }]
        })
      });

      const result = await response.json();
      if (!result.result?.value) {
        throw new Error("Switch account not found");
      }

      // Parse account data
      const accountDataBase64 = result.result.value.data[0];
      const buffer = Uint8Array.from(atob(accountDataBase64), c => c.charCodeAt(0));
      
      // Parse DeadManSwitch struct with correct offsets:
      let offset = 8; // Skip Anchor discriminator
      offset += 32;   // Skip owner (32 bytes)
      
      // last_ping: 8 bytes at offset 40
      const lastPing = Number(
        new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getBigInt64(0, true)
      );
      offset += 8;
      
      // ping_interval: 8 bytes at offset 48
      const pingInterval = Number(
        new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getBigInt64(0, true)
      );
      
      // Calculate expiration time: last_ping + ping_interval
      const expirationTime = lastPing + pingInterval;
      
      console.log('📊 Switch data fetched:');
      console.log('  - Last ping:', lastPing, '(', new Date(lastPing * 1000).toISOString(), ')');
      console.log('  - Ping interval:', pingInterval, 'seconds');
      console.log('  - Expiration time:', expirationTime, '(', new Date(expirationTime * 1000).toISOString(), ')');
      
      return expirationTime;
      
    } catch (error) {
      console.error('❌ Failed to fetch switch data:', error);
      if (error instanceof Error && error.message.includes('Account not found')) {
        throw new Error(`Switch not found on Solana. If you're creating a new switch, provide the expirationTime parameter directly.`);
      }
      throw new Error(`Failed to fetch switch expiration data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper: create Solana-specific auth signature for Lit Protocol
  const getOrCreateAuthSig = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    const cacheKey = 'lit-solana-authSig'
    
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached)
        // Validate cache is not too old (24 hours) and belongs to current wallet
        if (Date.now() - parsedCache.timestamp < 24 * 60 * 60 * 1000 && 
            parsedCache.authSig.address === wallet.publicKey.toBase58()) {
          console.log('🔄 Using cached Solana auth signature')
          return parsedCache.authSig
        }
      } catch (e) {
        // Invalid cache format, clear it
        localStorage.removeItem(cacheKey)
      }
    }

    console.log('🔑 Creating new Solana auth signature for Lit Protocol')
    
    // Create a simple message to sign (Solana-style, not SIWE)
    const message = `I am proving ownership of this Solana wallet for Lit Protocol encryption.
Address: ${wallet.publicKey.toString()}
Timestamp: ${Date.now()}`

    const messageBytes = new TextEncoder().encode(message)
    const signature = await wallet.signMessage(messageBytes)
    
    const authSig = {
      sig: Buffer.from(signature).toString('base64'), // Must be base64 for Solana
      derivedVia: 'solana.signMessage',
      signedMessage: message,
      address: wallet.publicKey.toBase58(), // Must use toBase58() for Solana addresses
    }

    // Cache the auth signature with timestamp
    localStorage.setItem(cacheKey, JSON.stringify({
      authSig,
      timestamp: Date.now()
    }))

    console.log('✅ Created Solana auth signature')
    return authSig
  }

  useEffect(() => {
    const initLit = async () => {
      if (litNodeClient || isConnecting) return

      // Clear any stale session data on initialization
      console.log('🧹 Clearing stale Lit Protocol session data...')
      localStorage.removeItem('lit-authSig') // Old Ethereum-style cache
      localStorage.removeItem('lit-sessionSigs') // Stale session signatures
      
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

      // No need to fetch expiration time - IPFS Lit Action handles this dynamically

      // Use proper Lit Action access control with IPFS CID
      const accessControlConditions = [
        {
          contractAddress: "ipfs://bafybeihpumgncikrjtqzpsigs2fnb7y5gujt2zcvc4spohledoapqd4x3a",
          standardContractType: "LitAction",
          chain: "ethereum", // Must be EVM chain for LitAction access control (even though Lit Action reads Solana)
          method: "checkExpiry", 
          parameters: [switchPDA.toString()],
          returnValueTest: {
            comparator: "=",
            value: "true"
          }
        }
      ];

      // Switch metadata is embedded in compact format

      // Get Solana authSig for encryption
      const authSig = await getOrCreateAuthSig();
      
      // Use Lit's encryption with proper Lit Action access control
      const encryptParams = {
        dataToEncrypt: message,
        accessControlConditions,
        authSig,
        chain: 'solana',
        jsParams: {
          // No jsParams needed - switch PDA passed via accessControlConditions parameters
        }
      };

      // 🐞 Debug: show all parameters sent to litNodeClient.encrypt
      console.groupCollapsed('%c📝 Lit.encrypt() parameters','color:#fa0');
      Object.entries(encryptParams).forEach(([k,v])=>{
        if (k==='dataToEncrypt') {
          console.log(`${k}: Uint8Array(${(v as Uint8Array).length})`);
        } else {
          console.log(`${k}:`, v);
        }
      });
      console.groupEnd();

      const { ciphertext, dataToEncryptHash } = await encryptString(encryptParams, litNodeClient)

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
        cid: "bafybeihpumgncikrjtqzpsigs2fnb7y5gujt2zcvc4spohledoapqd4x3a", // Just the IPFS CID
        pda: switchPDA.toString() // Just the switch PDA
        // Reconstruct full accessControlConditions during decryption
      }

      // 🐞 Validate encodings & print diagnostics
      const isHex = (s:string)=>/^[0-9a-fA-F]+$/.test(s)
      console.groupCollapsed('%c📦 Encryption payload debug','color:#0af')
      console.log('ciphertextBase64 valid?', isAlreadyBase64(ciphertextBase64))
      console.log('dataToEncryptHash hex?', isHex(dataToEncryptHash))
      console.log('ciphertext length (bytes):', Buffer.from(ciphertextBase64,'base64').length)
      console.log('dataToEncryptHash length:', dataToEncryptHash.length)
      
      // Show detailed sizes of each component
      console.log('\n📏 Component sizes:')
      console.log('  ciphertextBase64:', ciphertextBase64.length, 'chars')
      console.log('  dataToEncryptHash:', dataToEncryptHash.length, 'chars')
      console.log('  IPFS CID:', "bafybeihpumgncikrjtqzpsigs2fnb7y5gujt2zcvc4spohledoapqd4x3a".length, 'chars')
      console.log('  Switch PDA:', switchPDA.toString().length, 'chars')
      
      console.groupEnd()

      console.log('✅ Message encrypted with Dead Man\'s Switch logic')
      console.log('🔧 Access control: IPFS Lit Action (bafybeihpumgncikrjtqzpsigs2fnb7y5gujt2zcvc4spohledoapqd4x3a)')
      console.log('🔧 Chain: ethereum (required for LitAction schema, Lit Action reads Solana data)')
      console.log('🔧 Switch PDA passed to Lit Action:', switchPDA.toString())
      console.log('🔧 Lit Action will dynamically fetch and check expiration on each decrypt attempt')

      // Create encrypted string
      const finalEncryptedString = JSON.stringify(compactEncryptedData)
      console.log('🔧 Encrypted data size:', finalEncryptedString.length, 'bytes')
      
      // 🐞 LOG ENTIRE ENCRYPTED STRING FOR DEBUGGING
      console.groupCollapsed('%c🔍 FULL ENCRYPTED STRING CONTENT', 'color: #ff0000; font-weight: bold; font-size: 14px;')
      console.log('Full encrypted string:')
      console.log(finalEncryptedString)
      console.log('\nFormatted JSON:')
      console.log(JSON.stringify(JSON.parse(finalEncryptedString), null, 2))
      console.log('\nByte breakdown:')
      const parsed = JSON.parse(finalEncryptedString)
      Object.entries(parsed).forEach(([key, value]) => {
        const size = JSON.stringify(value).length
        console.log(`  ${key}: ${size} bytes - ${JSON.stringify(value).substring(0, 100)}${JSON.stringify(value).length > 100 ? '...' : ''}`)
      })
      console.log(`\nTotal size: ${finalEncryptedString.length} bytes (limit: 512 bytes)`)
      console.log(`Over limit by: ${finalEncryptedString.length > 512 ? finalEncryptedString.length - 512 : 0} bytes`)
      console.groupEnd()

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
    /* 0️⃣  Preconditions */
    if (!litNodeClient) throw new Error('Lit client not ready');
    if (!wallet.publicKey || !wallet.signMessage)
      throw new Error('Wallet not connected');

    const encryptedString = new TextDecoder().decode(encryptedData)
    
    // Parse the encrypted data to extract Lit Action code and access control conditions
    let parsedData: any;
    try {
      parsedData = JSON.parse(encryptedString);
    } catch {
      throw new Error('Invalid encrypted data format');
    }

    // Extract required data
    const ciphertext = parsedData.c || parsedData.ciphertext;
    const dataToEncryptHash = parsedData.h || parsedData.dataToEncryptHash;
    
    // Reconstruct access control conditions from minimal stored data
    let accessControlConditions;
    if (parsedData.cid && parsedData.pda) {
      // New format: reconstruct from CID and PDA
      accessControlConditions = [
        {
          contractAddress: `ipfs://${parsedData.cid}`,
          standardContractType: "LitAction",
          chain: "ethereum",
          method: "checkExpiry", 
          parameters: [parsedData.pda],
          returnValueTest: {
            comparator: "=",
            value: "true"
          }
        }
      ];
    } else {
      // Legacy format: use stored access control conditions
      accessControlConditions = parsedData.accessControlConditions;
    }

    // Get switch PDA - either from stored data or derive from parameters
    let switchPDA;
    if (parsedData.pda) {
      // New format: PDA stored in encrypted data
      switchPDA = new PublicKey(parsedData.pda);
    } else {
      // Legacy format: derive PDA from parameters
      const ownerPk = _ownerPubkey || wallet.publicKey!.toString();
      const switchId = _switchId || 'unknown';
      
      [switchPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("switch"),
          new PublicKey(ownerPk).toBuffer(),
          Buffer.from(switchId)
        ],
        new PublicKey(config.PROGRAM_ID)
      );
    }

    if (!ciphertext || !dataToEncryptHash) {
      throw new Error('Missing ciphertext or dataToEncryptHash');
    }
    
    if (!accessControlConditions) {
      throw new Error('Missing access control conditions. This data was encrypted with an older version.');
    }

    if (!switchPDA) {
      throw new Error('Cannot derive switch PDA. Missing switchId or owner parameters.');
    }

    console.log('🔍 Decrypting with IPFS Lit Action approach');
    console.log('📝 Using stored access control conditions with IPFS Lit Action');
    console.log('🔄 Lit Action will dynamically verify expiration for switch:', switchPDA.toString());

    // Get authSig for session
    const authSig = await getOrCreateAuthSig();

    // Prepare decryption parameters with IPFS Lit Action
    const decryptParams = {
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      authSig,
      chain: 'solana',
      jsParams: {
        // No jsParams needed - Lit Action gets everything from accessControlConditions
      }
    };

    console.log('🔄 Decrypting with IPFS Lit Action access control...');
    console.log('📍 Lit Action will dynamically check: current_time >= (last_ping + ping_interval)');
    console.log('⚡ No client-side expiration checks needed - all handled by Lit Action');

    try {
      // Use standard decryptToString - Lit Protocol will execute the access control Lit Action
      const decryptedMessage = await decryptToString(decryptParams, litNodeClient);
      
      console.log('✅ Successfully decrypted message using Lit Action access control');
      return decryptedMessage;

    } catch (error) {
      console.error('❌ Lit Action decryption failed:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Failed to decrypt message';
      if (error instanceof Error) {
        if (error.message.includes('access')) {
          userMessage = 'Access denied: The switch has not expired yet or access conditions are not met.';
        } else if (error.message.includes('fetch')) {
          userMessage = 'Network error: Unable to verify switch status. Please check your internet connection.';
        } else if (error.message.includes('expired')) {
          userMessage = 'This switch has not expired yet. Decryption is only available after expiration.';
        } else {
          userMessage = `Decryption failed: ${error.message}`;
        }
      }
      
      throw new Error(userMessage);
    }
  }

  return {
    litNodeClient,
    isConnecting,
    error,
    connectionStatus,
    connected: !!litNodeClient,
    encryptMessage,
    decryptMessage,
    fetchSwitchExpirationTime, // Export for use in other components
  }
}