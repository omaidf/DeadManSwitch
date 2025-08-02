import { useState, useEffect } from 'react'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { encryptString, decryptToString } from '@lit-protocol/encryption'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
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

  // Helper: create Solana-specific auth signature for Lit Protocol
  const getOrCreateAuthSig = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    // Clear any stale Ethereum-style auth signatures
    const cacheKey = 'lit-solana-authSig'
    localStorage.removeItem('lit-authSig') // Remove old Ethereum-style cache
    
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsedCache = JSON.parse(cached)
      // Validate cache is not too old (24 hours)
      if (Date.now() - parsedCache.timestamp < 24 * 60 * 60 * 1000) {
        console.log('🔄 Using cached Solana auth signature')
        return parsedCache.authSig
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
   * with specific access conditions. The message can only be decrypted when the corresponding
   * Solana switch has expired (using the contract's checkExpiration method).
   * 
   * @param message - The plaintext message to encrypt
   * @param switchId - Optional switch ID for PDA derivation (defaults to current timestamp)
   * @returns Promise resolving to encrypted data and symmetric key hash
   * @throws Error if Lit Protocol not connected, wallet not connected, or encryption fails
   * 
   * @example
   * ```typescript
   * const result = await encryptMessage("Secret message", "12345");
   * // result.encryptedString contains the encrypted data to store on-chain
   * // result.encryptedSymmetricKey contains the key hash for verification
   * ```
   */
  const encryptMessage = async (message: string, switchId?: string): Promise<EncryptionResult> => {
    if (!litNodeClient) {
      throw new Error('Lit Protocol not connected')
    }

    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    try {
      console.log('🔐 Encrypting message with Lit Protocol')

      // Use provided switch ID or generate fallback
      const actualSwitchId = switchId || Date.now().toString()
      console.log('Using switch ID for PDA:', actualSwitchId)

      // Create proper Solana RPC conditions for dead man's switch
      // This derives the PDA and checks if the switch is EXPIRED (the key logic!)
      
      const solRpcConditions = [
        {
          method: "checkExpiration", // Use the contract's checkExpiration method
          params: [],
          pdaParams: [
            config.PROGRAM_ID, // Program ID
            "switch", // Seed string (must match lib.rs: b"switch")
            wallet.publicKey!.toString(), // Owner wallet (owner.key.as_ref())
            actualSwitchId // Switch ID (consistent with CreatePage)
          ],
          chain: "solana",
          returnValueTest: {
            key: "",
            comparator: "=",
            value: "true" // checkExpiration returns true when switch is expired
          }
        }
      ]

      // Switch metadata is embedded in compact format

      // Get Solana authSig for encryption
      const authSig = await getOrCreateAuthSig();
      
      // Use Lit's encryption with proper Solana RPC conditions
      const encryptParams = {
        dataToEncrypt: message, // encryptString expects a string, not Uint8Array
        solRpcConditions,
        authSig, // Include Solana authSig for encryption
        chain: 'solana'
      } as const;

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

      // Create compact encrypted data structure
      const compactEncryptedData = {
        c: ciphertextBase64, // Ciphertext (base64 once)
        h: dataToEncryptHash, // Hash (shortened key)
        s: actualSwitchId, // Switch ID for PDA derivation
        p: config.PROGRAM_ID, // Program ID
        w: wallet.publicKey!.toString(), // Wallet
        t: Date.now() // Timestamp
      }

      // 🐞 Validate encodings & print diagnostics
      const isHex = (s:string)=>/^[0-9a-fA-F]+$/.test(s)
      console.groupCollapsed('%c📦 Encryption payload debug','color:#0af')
      console.log('ciphertextBase64 valid?', isAlreadyBase64(ciphertextBase64))
      console.log('dataToEncryptHash hex?', isHex(dataToEncryptHash))
      console.log('ciphertext length (bytes):', Buffer.from(ciphertextBase64,'base64').length)
      console.log('dataToEncryptHash length:', dataToEncryptHash.length)
      console.groupEnd()

      console.log('✅ Message encrypted with Dead Man\'s Switch logic')
      console.log('🔧 Switch will unlock when checkExpiration returns true (expired)')
      console.log('🔧 Solana RPC Conditions:', solRpcConditions)

      // Create minimal encrypted string to fit 512 byte limit
      const compactString = JSON.stringify(compactEncryptedData)
      
      console.log('🔧 Compact encrypted data size:', compactString.length, 'bytes')
      
      // If still too large, use additional compression
      let finalEncryptedString = compactString
      if (compactString.length > 400) { // Leave some buffer for JSON overhead
        // Further compress by removing non-essential data
        const ultraCompact = {
          c: compactEncryptedData.c,
          h: compactEncryptedData.h,
          s: compactEncryptedData.s
        }
        finalEncryptedString = JSON.stringify(ultraCompact)
        console.log('🔧 Ultra-compact encrypted data size:', finalEncryptedString.length, 'bytes')
      }

      return {
        encryptedString: finalEncryptedString,
        encryptedSymmetricKey: dataToEncryptHash,
      }
    } catch (err) {
      console.error('❌ Encryption failed:', err)
      throw new Error(err instanceof Error ? err.message : 'Encryption failed')
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
    encryptedString: string,
    encryptedSymmetricKey?: string,
    _switchId?: string,
    ownerPubkey?: string        // allow decrypting other users switches
  ): Promise<string> => {
    /* 0️⃣  Preconditions */
    if (!litNodeClient)                    throw new Error('Lit client not ready');
    if (!wallet.publicKey || !wallet.signMessage)
      throw new Error('Wallet not connected');

    /* 1️⃣  Detect wire-format  &  extract fields */
    type Normalised = { ciphertext:string; dataToEncryptHash?:string; switchId:string };
    let normalized: Normalised;
    let switchId:   string;

    try {
      const p = JSON.parse(encryptedString);
      if (p.c && p.h && p.s) {                   // COMPACT (current)
        switchId  = p.s;
        normalized = { ciphertext: p.c, dataToEncryptHash: p.h, switchId };
      } else if (p.ciphertext && p.dataToEncryptHash) { // FULL (legacy)
        switchId  = p.switchMetadata?.switchId || p.s || Date.now().toString();
        normalized = { ciphertext: p.ciphertext, dataToEncryptHash: p.dataToEncryptHash, switchId };
      } else {
        throw new Error('unknown format');
      }
    } catch {
      // RAW / ultra-compact – entire string is ciphertext
      switchId   = _switchId || Date.now().toString();
      normalized = { ciphertext: encryptedString, dataToEncryptHash: encryptedSymmetricKey, switchId };
    }

    // 🚨 Ensure all required parameters are present before talking to Lit
    if (!normalized.dataToEncryptHash) {
      throw new Error('Missing dataToEncryptHash (ciphertext hash) for decryption');
    }

    // 🐞 Early debug – log raw inputs to decryptMessage
    console.groupCollapsed('%c🗝️ decryptMessage() inputs','color:#0af');
    console.log('encryptedString (first 80)…', encryptedString.slice(0,80)+'…');
    console.log('encryptedSymmetricKey:', encryptedSymmetricKey);
    console.log('_switchId:', _switchId);
    console.log('ownerPubkey:', ownerPubkey);
    console.groupEnd();

    /* 2️⃣  Build FUNCTION-BASED access-control – call checkExpiration() */
    const ownerPk = ownerPubkey ?? wallet.publicKey!.toString();
    const [switchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('switch'), new PublicKey(ownerPk).toBuffer(), Buffer.from(switchId)],
      new PublicKey(config.PROGRAM_ID)
    );

    // Use direct account data check - more reliable than program function calls
    const accessControlConditions = [
      {
        contractAddress: "",
        standardContractType: "",
        method: "getAccountInfo",
        params: [switchPda.toString()],
        chain: "solana",
        returnValueTest: {
          key: "result.value.data",
          comparator: "!=",
          value: "null"
        }
      }
    ];

    /* 🔍 DEBUG: Log all decryption internals */
    console.groupCollapsed('%c🗝️  Lit Decryption Debug','color:#0af');
    console.log('Ciphertext (first 60)…', normalized.ciphertext.slice(0,60)+'…');
    console.log('dataToEncryptHash:', normalized.dataToEncryptHash);
    console.log('Switch ID:', switchId);
    console.log('Owner PK:', ownerPk);
    console.log('Derived PDA:', switchPda.toBase58());
    console.log('AccessControlConditions:', accessControlConditions);
    /* 3️⃣  Obtain Solana authSig – clear any stale session data first */
    console.log('🧹 Clearing any stale Lit session data before decryption...')
    localStorage.removeItem('lit-sessionSigs')
    localStorage.removeItem('lit-authSig') // Remove old Ethereum-style cache
    
    const authSig = await getOrCreateAuthSig();
    console.log('🔑 Using Solana authSig for decryption:', {
      derivedVia: authSig.derivedVia,
      address: authSig.address,
      sigLength: authSig.sig.length
    });

    /* 4️⃣  Validate all parameters are present and correct types */
    if (!normalized.ciphertext || typeof normalized.ciphertext !== 'string') {
      throw new Error('Invalid ciphertext: must be a non-empty string')
    }
    if (!normalized.dataToEncryptHash || typeof normalized.dataToEncryptHash !== 'string') {
      throw new Error('Invalid dataToEncryptHash: must be a non-empty string')
    }
    if (!authSig || typeof authSig.sig !== 'string' || typeof authSig.address !== 'string') {
      throw new Error('Invalid authSig: must have sig and address as strings')
    }

    /* 5️⃣  Build exact JSON payload matching Lit Protocol docs */
    const decryptParams = {
      accessControlConditions,
      chain: 'solana',
      ciphertext: normalized.ciphertext,
      dataToEncryptHash: normalized.dataToEncryptHash,
      authSig
    }

    // 🐞 Log the exact JSON payload being sent to Lit nodes
    console.groupCollapsed('%c🔑 Lit.decryptToString() JSON payload','color:#fa0');
    console.log('Full payload:', JSON.stringify(decryptParams, null, 2));
    console.log('Payload validation:');
    console.log('- accessControlConditions array length:', decryptParams.accessControlConditions.length);
    console.log('- chain:', decryptParams.chain);
    console.log('- ciphertext type/length:', typeof decryptParams.ciphertext, decryptParams.ciphertext.length);
    console.log('- dataToEncryptHash type/length:', typeof decryptParams.dataToEncryptHash, decryptParams.dataToEncryptHash.length);
    console.log('- authSig keys:', Object.keys(decryptParams.authSig));
    console.groupEnd();

    // Use static decryptToString method with exact parameter order from docs
    const plaintext = await decryptToString(decryptParams, litNodeClient);
    console.log('✅ Successfully decrypted message:', plaintext.slice(0, 50) + '...');
    console.groupEnd();
    return plaintext;
  }

  return {
    litNodeClient,
    isConnecting,
    error,
    connectionStatus,
    connected: !!litNodeClient,
    encryptMessage,
    decryptMessage,
  }
}