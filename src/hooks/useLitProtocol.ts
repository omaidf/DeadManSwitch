import { useState, useEffect } from 'react'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { encryptString, decryptToString } from '@lit-protocol/encryption'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { getConfig } from '../lib/config'

// IPFS CID for the Dead Man's Switch Lit Action
const DEAD_MANS_SWITCH_IPFS_CID = 'QmZRU4SSZXHr7eKSvsopghRYkAj3PAtu4yLNZzmUNLzzsS'

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

      // No need to fetch expiration time - IPFS Lit Action handles this dynamically

      // Use proper Lit Action access control with IPFS CID + allow ANY Solana address to decrypt
      const accessControlConditions = [
        {
          contractAddress: `ipfs://${DEAD_MANS_SWITCH_IPFS_CID}`,
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
            value: "0"
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
        solRpcConditions,
        authSig,
        chain: 'solana',
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
        cid: DEAD_MANS_SWITCH_IPFS_CID, // Just the IPFS CID
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
      console.log('  IPFS CID:', DEAD_MANS_SWITCH_IPFS_CID.length, 'chars')
      console.log('  Switch PDA:', switchPDA.toString().length, 'chars')
      
      console.groupEnd()

      console.log('✅ Message encrypted with Dead Man\'s Switch logic')
      console.log('🔧 Access control: IPFS Lit Action (' + DEAD_MANS_SWITCH_IPFS_CID + ')')
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
    
    // Reconstruct access control conditions from minimal stored data
    console.log('🔍 Step 5: Reconstructing access control conditions...');
    let accessControlConditions;
    let solRpcConditions;
    
    if (parsedData.cid && parsedData.pda) {
      console.log('✅ Using new format: CID + PDA reconstruction');
      console.log('  - IPFS CID:', parsedData.cid);
      console.log('  - Switch PDA:', parsedData.pda);
      

      
      // New format: reconstruct from CID and PDA with separate arrays (matching encryption format)
      accessControlConditions = [
        {
          contractAddress: `ipfs://${parsedData.cid}`,
          standardContractType: "LitAction",
          chain: "solana",
          method: "checkExpiry", 
          parameters: [parsedData.pda],
          returnValueTest: {
            comparator: "=",
            value: "true"
          }
        }
      ];

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
            value: "0"
          }
        }
      ];
      
      console.log('✅ Access control conditions reconstructed from CID + PDA');
    } else {
      console.log('⚠️ Using legacy format: stored access control conditions');
      // Legacy format: use stored access control conditions
      accessControlConditions = parsedData.accessControlConditions;
      console.log('📋 Legacy accessControlConditions:', accessControlConditions ? 'present' : 'MISSING');
    }

    console.log('🔍 Step 6: Determining switch PDA...');
    // Get switch PDA - either from stored data or derive from parameters
    let switchPDA;
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
    
    if (!accessControlConditions) {
      console.error('❌ Missing access control conditions');
      throw new Error('Missing access control conditions. This data was encrypted with an older version.');
    }
    console.log('✅ Access control conditions present');

    if (!switchPDA) {
      console.error('❌ No switch PDA available');
      throw new Error('Cannot derive switch PDA. Missing switchId or owner parameters.');
    }
    console.log('✅ Switch PDA confirmed:', switchPDA.toString());

    console.log('🔍 Decrypting with IPFS Lit Action approach');
    console.log('📝 Using access control: Lit Action (expiry check) + Solana RPC (balance >= 0)');
    console.log('🌍 ANYONE with a Solana wallet can decrypt if the switch has expired!');
    console.log('🔄 Lit Action will dynamically verify expiration for switch:', switchPDA.toString());
    
    // 🐞 DEBUG: Log the actual conditions being used
    console.log('🔍 ACCESS CONTROL CONDITIONS:', JSON.stringify(accessControlConditions, null, 2));
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
    
    // Prepare decryption parameters with IPFS Lit Action
    const decryptParams = {
      accessControlConditions,
      solRpcConditions,
      ciphertext,
      dataToEncryptHash,
      authSig,
      chain: 'solana',
    };
    
    console.log('📋 Decryption parameters prepared:');
    console.log('  - accessControlConditions:', accessControlConditions ? `${accessControlConditions.length} conditions` : 'MISSING');
    console.log('  - solRpcConditions:', solRpcConditions ? `${solRpcConditions.length} conditions` : 'MISSING');
    console.log('  - ciphertext length:', ciphertext.length);
    console.log('  - dataToEncryptHash length:', dataToEncryptHash.length);
    console.log('  - authSig present:', !!authSig);
    console.log('  - chain:', 'solana');

    console.log('🔄 Decrypting with fresh auth signature and IPFS Lit Action access control...');
    console.log('📍 Lit Action will dynamically check: current_time >= (last_ping + ping_interval)');
    console.log('🌍 Solana RPC will check: user has balance >= 0 (always true - allows ANY address)');
    console.log('⚡ No client-side expiration checks needed - all handled by Lit Action');

    console.log('🔍 Step 10: EXECUTING LIT PROTOCOL DECRYPTION...');
    console.log('⏱️ Starting decryption at:', new Date().toISOString());
    
    // Log the exact request being made
    console.groupCollapsed('📤 FULL DECRYPT REQUEST TO LIT PROTOCOL');
    console.log('decryptParams:', JSON.stringify(decryptParams, null, 2));
    console.log('litNodeClient status:', !!litNodeClient);
    console.groupEnd();

    // Track timing for both success and failure cases
    const startTime = Date.now();
    
    try {
      // Use standard decryptToString - Lit Protocol will execute the access control Lit Action
      console.log('🚀 CALLING decryptToString() - Lit Protocol will now:');
      console.log('  1️⃣ Execute Lit Action at ipfs://' + DEAD_MANS_SWITCH_IPFS_CID);
      console.log('  2️⃣ Call Solana RPC getBalance');
      console.log('  3️⃣ Evaluate both conditions');
      console.log('  4️⃣ Return decrypted message if both pass');
      
      const decryptedMessage = await decryptToString(decryptParams, litNodeClient);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('🎉 ==================== DECRYPTION SUCCESS ====================');
      console.log('⏱️ Total decryption time:', duration, 'ms');
      console.log('⏱️ Completed at:', new Date().toISOString());
      console.log('');
      console.log('🎯 CONDITION RESULTS (inferred from success):');
      console.log('  ✅ LIT ACTION RESULT: TRUE');
      console.log('     → checkExpiry() returned true');  
      console.log('     → Switch has expired - decryption allowed');
      console.log('  ✅ SOLANA RPC RESULT: TRUE');
      console.log('     → getBalance() >= 0 check passed');
      console.log('     → User has valid Solana address');
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
          
          if (errorMsg.includes('litaction') || errorMsg.includes('ipfs')) {
            console.log('  ❌ LIT ACTION FAILED:');
            console.log('     → checkExpiry() likely returned FALSE');
            console.log('     → Dead Man\'s Switch has NOT expired yet');
            console.log('     → current_time < (last_ping + ping_interval)');
            console.log('  ℹ️ SOLANA RPC: Not executed (Lit Action failed first)');
          } else if (errorMsg.includes('balance') || errorMsg.includes('solana') || errorMsg.includes('rpc')) {
            console.log('  ✅ LIT ACTION: Likely passed (switch expired)');
            console.log('  ❌ SOLANA RPC FAILED:');
            console.log('     → getBalance() check failed');
            console.log('     → User address may be invalid');
            console.log('     → Solana RPC may be unreachable');
          } else {
            console.log('  ❓ UNKNOWN ACCESS CONTROL FAILURE:');
            console.log('     → Could be either Lit Action or Solana RPC');
            console.log('     → Check individual condition logs above');
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
          
        } else if (errorMsg.includes('ipfs') || errorMsg.includes('cid')) {
          console.log('');
          console.log('🎯 IPFS/LIT ACTION LOADING FAILURE:');
          console.log('  ❌ CANNOT LOAD LIT ACTION:');
          console.log('     → IPFS CID may be invalid');
                      console.log('     → IPFS Lit Action not accessible');
          console.log('     → IPFS gateway unreachable');
          console.log('  ℹ️ CONDITIONS: Cannot be evaluated (Lit Action not loaded)');
          
        } else {
          console.log('');
          console.log('🎯 UNKNOWN ERROR TYPE:');
          console.log('  ❓ UNRECOGNIZED FAILURE:');
          console.log('     → Error type not in our analysis patterns');
          console.log('     → Check raw error message above');
          console.log('     → May be a new error type');
        }
        
        // Additional debugging info
        console.log('');
        console.log('🔍 SIWS DEBUGGING CHECKLIST:');
        console.log('  ✓ Check browser dev tools Network tab for failed requests');
        console.log('  ✓ Look for CORS errors in console');
        console.log('  ✓ Verify IPFS gateway accessibility');
        console.log('  ✓ Test Solana RPC manually: https://api.devnet.solana.com');
        console.log('  ✓ Ensure authSig address matches access control conditions');
        console.log('  ✓ Confirm signature is hex format without 0x prefix');
        console.log('  ✓ Verify SIWS message has Chain ID: 0 and Expiration Time');
        console.log('  ✓ Check SIWS timestamp is current (not expired)');
        console.log('  ✓ Ensure wallet supports Solana signMessage()');
        console.log('  ✓ Verify random nonce and proper message structure');
        
      } else {
        console.log('❌ Non-Error object thrown:', typeof error, error);
      }
      
      console.log('💥 ==================== DECRYPTION FAILURE ====================');
      
      // Provide user-friendly error messages
      let userMessage = 'Failed to decrypt message';
      if (error instanceof Error) {
        if (error.message.includes('access')) {
          userMessage = 'Access denied: The switch has not expired yet or access conditions are not met.';
        } else if (error.message.includes('fetch')) {
          userMessage = 'Network error: Unable to verify switch status. Please check your internet connection.';
        } else if (error.message.includes('expired')) {
          userMessage = 'This switch has not expired yet. Decryption is only available after expiration.';
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
    fetchSwitchExpirationTime, // Export for use in other components
    clearCachedAuthData, // Export for manual cache clearing
  }
}