import { useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, web3, Idl } from '@coral-xyz/anchor'
import { BN } from 'bn.js'
import { PublicKey } from '@solana/web3.js'
import { getConfig } from '../lib/config'
import { safeBigIntToNumber } from '../types'
import IDL_JSON from '../idl.json'

// Use the actual IDL from the JSON file
const IDL = IDL_JSON as unknown as Idl

/**
 * Custom React hook for interacting with the Dead Man's Switch Solana program.
 * 
 * Provides a comprehensive interface for all program operations including:
 * - Creating new switches with encrypted data
 * - Pinging switches to reset timers
 * - Querying switch information and expiration status
 * - Managing user switches (fetch, deactivate, close)
 * - Retrieving all switches and expired switches
 * 
 * @returns Object containing program instance and all interaction functions
 */
export function useProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const config = getConfig()

  const program = useMemo(() => {
    // Allow read-only access even without a connected wallet by falling back to a dummy wallet.
    // Any state-changing RPC (create/ping/deactivate etc.) will still guard against missing wallet, 
    // but read-only queries like account.fetch work fine with this lightweight stub.
    const readOnlyWallet = {
      publicKey: new PublicKey('11111111111111111111111111111111'),
      async signTransaction(tx: any) { return tx },
      async signAllTransactions(txs: any) { return txs },
    }

    // Use real wallet if available, otherwise stub
    const walletForProvider = wallet.publicKey ? (wallet as any) : (readOnlyWallet as any)

    try {
      const provider = new AnchorProvider(connection, walletForProvider, {
        commitment: 'confirmed'
      })
      
      console.log('🔧 Provider ready:', !!provider)
      console.log('🔧 IDL loaded:', !!IDL)
      
      // For Anchor v0.26.0+, the address is passed explicitly to the Program constructor
      const anchorProgramId = new PublicKey(config.PROGRAM_ID)
      console.log('🔧 Using Program ID from config:', anchorProgramId.toString())
      
      const program = new Program(IDL, anchorProgramId, provider)
      console.log('✅ Program initialized successfully with address:', program.programId.toString())
      return program
    } catch (error) {
      console.error('❌ Failed to create program:', error)
      return null
    }
  }, [connection, wallet, config.PROGRAM_ID])

  /**
   * Creates a new dead man's switch on the Solana blockchain.
   * 
   * This function handles the complete process of creating a switch:
   * - Validates input parameters against program constraints
   * - Generates a Program Derived Address (PDA) for the switch
   * - Converts encrypted data to proper format for blockchain storage
   * - Executes the on-chain transaction
   * 
   * @param id - Unique identifier for the switch (must be positive integer)
   * @param encryptedMessage - Encrypted data from Lit Protocol (max 512 bytes when encoded)
   * @param pingInterval - Time in seconds between required pings (60s - 1 year)
   * @returns Promise resolving to object with transaction signature and switch PDA
   * @throws Error if wallet not connected, invalid parameters, or transaction fails
   */
  const createSwitch = async (id: number, encryptedMessage: string, pingInterval: number) => {
    console.log('🔧 Debug createSwitch called with:', { id, encryptedMessage: encryptedMessage.slice(0, 50) + '...', pingInterval })
    console.log('🔧 Wallet state:', { 
      connected: wallet.connected, 
      publicKey: wallet.publicKey?.toString(),
      signMessage: !!wallet.signMessage,
      signTransaction: !!wallet.signTransaction
    })
    console.log('🔧 Program state:', { 
      program: !!program, 
      programId: program?.programId?.toString(),
      provider: !!program?.provider
    })
    
    if (!program) {
      throw new Error('Anchor program not initialized. Please check your wallet connection and network.')
    }
    
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }
    
    if (!wallet.signTransaction) {
      throw new Error('Wallet does not support transaction signing. Please use a compatible wallet.')
    }

    // Parse the encrypted data and convert to bytes for Solana storage
    let encryptedData: Buffer
    try {
      // The encryptedMessage is a JSON string, we need to store it as bytes
      const encryptedBytes = new TextEncoder().encode(encryptedMessage)
      encryptedData = Buffer.from(encryptedBytes)
      
      console.log('🔧 Encrypted data size for Solana:', encryptedData.length, 'bytes')
      
      // Validate size before sending to program
      if (encryptedData.length > 512) {
        throw new Error(`Encrypted data too large: ${encryptedData.length} bytes (max 512 bytes)`)
      }
    } catch (parseError) {
      console.error('❌ Failed to process encrypted data:', parseError)
      throw new Error('Invalid encrypted data format')
    }

    // Generate PDA for the switch (must match lib.rs seeds)
    // The seeds must match exactly: b"switch", owner.key.as_ref(), &id.to_le_bytes()
    console.log('🔧 Generating PDA with seeds:')
    console.log('  - ID for PDA seeds:', id, '(type:', typeof id, ')')
    
    const idBytes = Buffer.alloc(8)
    idBytes.writeBigUInt64LE(BigInt(id), 0) // Convert to little-endian bytes as expected by Rust
    
    console.log('  - ID as BigInt:', BigInt(id))
    console.log('  - ID bytes (LE):', Array.from(idBytes))
    console.log('  - Switch seed:', Array.from(Buffer.from('switch')))
    console.log('  - Owner bytes:', Array.from(wallet.publicKey.toBuffer()).slice(0, 8) + '...')
    
    const [switchPDA, bump] = await PublicKey.findProgramAddress(
      [
        Buffer.from('switch'),
        wallet.publicKey.toBuffer(),
        idBytes
      ],
      program.programId
    )
    
    console.log('🔧 Generated PDA:', switchPDA.toString())
    console.log('🔧 PDA bump:', bump)
    console.log('🔧 PDA generation successful for ID:', id)

    // Declare BN variables outside try block for error reporting
    let bnId: any, bnPingInterval: any

    try {
      console.log('🔧 Creating transaction with parameters:')
      console.log('  - ID:', id, '(type:', typeof id, ', value:', id, ')')
      console.log('  - Ping Interval:', pingInterval, '(type:', typeof pingInterval, ', value:', pingInterval, ')')
      console.log('  - Encrypted Data (JSON string):', encryptedMessage.length, 'chars')
      console.log('  - Encrypted Data (as Buffer):', encryptedData.length, 'bytes, type:', typeof encryptedData, ', constructor:', encryptedData.constructor.name)
      console.log('  - Switch PDA:', switchPDA.toString())
      console.log('  - Owner:', wallet.publicKey.toString())
      
      // Validate parameter ranges
      console.log('🔧 Parameter validation:')
      console.log('  - ID > 0?', id > 0)
      console.log('  - ID <= MAX_SAFE_INTEGER?', id <= Number.MAX_SAFE_INTEGER)
      console.log('  - Ping interval >= 60?', pingInterval >= 60)
      console.log('  - Ping interval <= 1 year?', pingInterval <= 365 * 24 * 60 * 60)
      console.log('  - Encrypted data length <= 512?', encryptedData.length <= 512)
      
      // For Anchor's "bytes" type, we should pass the Buffer directly
      // Anchor will handle the proper Borsh encoding (length prefix + data)
      console.log('🔧 Using Buffer directly for Anchor bytes type:')
      console.log('  - Buffer length:', encryptedData.length)
      console.log('  - Buffer type:', typeof encryptedData)
      console.log('  - Buffer constructor:', encryptedData.constructor.name)
      console.log('  - Is Buffer?', Buffer.isBuffer(encryptedData))
      console.log('  - First 10 bytes:', Array.from(encryptedData.slice(0, 10)))
      
      // Try both approaches - let's test with BN objects first since toArrayLike error suggests BN is expected
      bnId = new BN(id)
      bnPingInterval = new BN(pingInterval)
      
      console.log('🔧 BN conversion check:')
      console.log('  - BN id:', bnId.toString(), '(type:', typeof bnId, ', constructor:', bnId.constructor.name, ')')
      console.log('  - BN pingInterval:', bnPingInterval.toString(), '(type:', typeof bnPingInterval, ', constructor:', bnPingInterval.constructor.name, ')')
      console.log('  - BN id has toArrayLike?', typeof bnId.toArrayLike === 'function')
      console.log('  - BN pingInterval has toArrayLike?', typeof bnPingInterval.toArrayLike === 'function')
      
      // Final parameter check before Anchor call
      console.log('🔧 Final parameters for Anchor (using BN objects and Buffer):')
      console.log('  - id:', bnId, '(type:', typeof bnId, ')')
      console.log('  - pingInterval:', bnPingInterval, '(type:', typeof bnPingInterval, ')')
      console.log('  - encryptedData:', encryptedData, '(type:', typeof encryptedData, ', length:', encryptedData.length, ')')
      
      // Use BN objects for numbers and Buffer for bytes type
      console.log('🔧 Calling Anchor method with proper types...')
      
      const tx = await program.methods
        .createSwitch(
          bnId,                         // u64 as BN object
          bnPingInterval,               // i64 as BN object
          encryptedData                 // Vec<u8> as Buffer (Anchor handles Borsh encoding)
        )
        .accounts({
          switch: switchPDA,
          owner: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()

      console.log('✅ Switch created successfully! Transaction:', tx)
      
      // 🎉 TOAST NOTIFICATION FOR USER
      // Create a visible toast notification
      const createToast = () => {
        // Simple toast using DOM manipulation since we don't have a toast library
        const toastDiv = document.createElement('div');
        toastDiv.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background: linear-gradient(135deg, #10b981, #059669);
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
              <span style="font-size: 20px; margin-right: 8px;">✅</span>
              <strong>Dead Man's Switch Created!</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">
              Your switch was successfully deployed to Solana
            </div>
            <div style="display: flex; gap: 10px;">
              <a href="https://solscan.io/tx/${tx}?cluster=devnet" target="_blank" 
                 style="background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; border: 1px solid rgba(255,255,255,0.3);">
                🔗 View Transaction
              </a>
              <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                      style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
                ✕ Close
              </button>
            </div>
          </div>
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideInFromRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toastDiv);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
          if (toastDiv.parentNode) {
            toastDiv.style.animation = 'slideInFromRight 0.3s ease-out reverse';
            setTimeout(() => toastDiv.remove(), 300);
          }
        }, 8000);
      };
      
      createToast();
      
      return { signature: tx, switchPDA }
    } catch (error) {
      console.error('❌ Failed to create switch:', error)
      
      // Enhanced error logging with stack trace
      if (error instanceof Error) {
        console.error('  - Error name:', error.name)
        console.error('  - Error message:', error.message)
        console.error('  - Error stack:', error.stack)
        if ('code' in error) {
          console.error('  - Error code:', (error as any).code)
        }

        
        // Debug the exact parameters that caused the error
        console.error('🔍 Parameters that caused the error:')
        console.error('  - Original id:', id, '(type:', typeof id, ')')
        console.error('  - Original pingInterval:', pingInterval, '(type:', typeof pingInterval, ')')
        console.error('  - BN id available?', bnId ? bnId.toString() : 'undefined')
        console.error('  - BN pingInterval available?', bnPingInterval ? bnPingInterval.toString() : 'undefined')
        console.error('  - encryptedData original:', encryptedData.constructor.name, 'length:', encryptedData.length)
        console.error('  - Program available?', !!program)
        console.error('  - Program ID:', program?.programId?.toString())
        console.error('  - Wallet connected?', !!wallet.publicKey)
        console.error('  - Anchor version:', (Program as any).version || 'unknown')
      }
      
      // Provide user-friendly error messages for common issues
      if (error instanceof Error && error.message.includes('This transaction has already been processed')) {
        throw new Error('This switch creation request was already processed. This can happen if you clicked submit multiple times quickly. Please wait a moment and try again with a new message if needed.')
      }
      
      throw error
    }
  }

  /**
   * Resets a switch's expiration timer by sending a ping transaction.
   * 
   * This function allows the switch owner to "check in" and prevent expiration.
   * Only the owner can ping their switches, and only active switches can be pinged.
   * 
   * @param switchPDA - The Program Derived Address of the switch to ping
   * @returns Promise resolving to the transaction signature
   * @throws Error if wallet not connected, unauthorized, or transaction fails
   */
  const pingSwitch = async (switchPDA: PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Program or wallet not available')
    }

    try {
      const tx = await program.methods
        .ping()
        .accounts({
          switch: switchPDA,
          owner: wallet.publicKey,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Failed to ping switch:', error)
      throw error
    }
  }

  /**
   * Checks if a specific switch has expired without modifying any state.
   * 
   * This is a read-only operation that queries the program to determine
   * if a switch has passed its expiration deadline based on blockchain time.
   * 
   * @param switchPDA - The Program Derived Address of the switch to check
   * @returns Promise resolving to true if expired, false if still active
   * @throws Error if program not available or RPC call fails
   */
  const checkExpiration = async (switchPDA: PublicKey): Promise<boolean> => {
    if (!program) {
      throw new Error('Program not available')
    }

    try {
      const result = await program.methods
        .checkExpiration()
        .accounts({
          switch: switchPDA,
        })
        .view()

      return result as boolean
    } catch (error) {
      console.error('Failed to check expiration:', error)
      
      // Fallback to client-side calculation if program call fails
      try {
        const account = await (program.account as any).deadManSwitch.fetch(switchPDA)
        const currentTime = Math.floor(Date.now() / 1000)
        const lastPing = typeof account.lastPing === 'bigint' ? Number(account.lastPing) : account.lastPing
        const pingInterval = typeof account.pingInterval === 'bigint' ? Number(account.pingInterval) : account.pingInterval
        
        // Safe overflow check
        if (lastPing > Number.MAX_SAFE_INTEGER - pingInterval) {
          return true // Treat overflow as expired
        }
        
        return currentTime >= (lastPing + pingInterval)
      } catch (fallbackError) {
        console.error('Fallback expiration check also failed:', fallbackError)
        return false
      }
    }
  }

  /**
   * Batch checks expiration status for multiple switches efficiently.
   * 
   * Uses the program's checkExpiration method for each switch but implements
   * batching and error handling to optimize performance and reliability.
   * 
   * @param switchPDAs - Array of switch PDAs to check
   * @returns Promise resolving to Map of PDA string -> expiration status
   */
  const batchCheckExpiration = async (switchPDAs: PublicKey[]): Promise<Map<string, boolean>> => {
    const results = new Map<string, boolean>()
    
    // Process in small batches to avoid overwhelming RPC
    const batchSize = 5
    for (let i = 0; i < switchPDAs.length; i += batchSize) {
      const batch = switchPDAs.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (pda) => {
        try {
          const isExpired = await checkExpiration(pda)
          return { pda: pda.toString(), isExpired }
        } catch (error) {
          console.warn('Failed to check expiration for switch:', pda.toString(), error)
          return { pda: pda.toString(), isExpired: false }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(({ pda, isExpired }) => {
        results.set(pda, isExpired)
      })
    }
    
    return results
  }

  /**
   * Retrieves comprehensive information about a specific switch using the program's getSwitchInfo method.
   * 
   * This uses the program's built-in getSwitchInfo function which returns rich computed data
   * including expiration status, timing calculations, and current blockchain time.
   * 
   * @param switchPDA - The Program Derived Address of the switch to query
   * @returns Promise resolving to SwitchInfo with computed properties
   * @throws Error if program not available, account not found, or RPC fails
   */
  const getSwitchInfo = async (switchPDA: PublicKey) => {
    if (!program) {
      throw new Error('Program not available')
    }

    try {
      // Bypassing the problematic .view() call and using .fetch() directly.
      // This is more reliable across different RPC providers.
      const accountInfo = await (program.account as any).deadManSwitch.fetch(switchPDA)
      return accountInfo
    } catch (error) {
      console.error('Failed to get switch info:', error)
      throw error
    }
  }

  /**
   * Retrieves raw account data for a switch (without computed properties).
   * 
   * Use this when you need direct access to the account structure without
   * the overhead of calling the program's getSwitchInfo method.
   * 
   * @param switchPDA - The Program Derived Address of the switch to query
   * @returns Promise resolving to the raw switch account data
   */
  const getSwitchAccount = async (switchPDA: PublicKey) => {
    if (!program) {
      throw new Error('Program not available')
    }

    try {
      const accountInfo = await (program.account as any).deadManSwitch.fetch(switchPDA)
      return accountInfo
    } catch (error) {
      console.error('Failed to get switch account:', error)
      throw error
    }
  }

  /**
   * Fetches all switches owned by the currently connected wallet.
   * 
   * Uses an optimized query with memcmp filter to retrieve only switches
   * belonging to the current user. Includes validation to ensure returned
   * switches actually belong to the connected wallet.
   * 
   * @returns Promise resolving to array of user's switch accounts with metadata
   * @throws Error if wallet not connected or RPC query fails
   */
  const getUserSwitches = async () => {
    if (!program) {
      const error = 'Program not initialized. Check wallet connection and network.'
      console.error('❌', error)
      throw new Error(error)
    }
    
    if (!wallet.publicKey) {
      const error = 'Wallet not connected'
      console.error('❌', error)
      throw new Error(error)
    }

    try {
      console.log('🔍 Fetching user switches with owner filter...')
      console.log('🔧 Wallet public key:', wallet.publicKey.toString())
      
      // 🎯 OPTIMIZED: Use filtered query instead of fetching ALL switches
      const userSwitches = await (program.account as any).deadManSwitch.all([
        {
          memcmp: {
            offset: 8, // Skip 8-byte discriminator to reach owner field
            bytes: wallet.publicKey.toBase58(),
          }
        }
      ])
      
      console.log('✅ Found', userSwitches.length, 'switches for user')
      
      // Validate that returned switches actually belong to the user
      const validatedSwitches = userSwitches.filter((switch_: any) => {
        const ownerMatches = switch_.account.owner.toString() === wallet.publicKey!.toString()
        if (!ownerMatches) {
          console.warn('⚠️ Memcmp returned switch not owned by user:', {
            switchOwner: switch_.account.owner.toString(),
            walletKey: wallet.publicKey!.toString(),
            switchPubkey: switch_.publicKey.toString().slice(0, 8)
          })
        }
        return ownerMatches
      })
      
      if (validatedSwitches.length !== userSwitches.length) {
        console.warn(`⚠️ Filtered out ${userSwitches.length - validatedSwitches.length} incorrectly matched switches`)
      }
      
      // Log switch details for debugging (only if we have switches)
      if (validatedSwitches.length > 0) {
        console.log('✅ Found', validatedSwitches.length, 'user switches')
        validatedSwitches.slice(0, 2).forEach((switch_: any) => {
          console.log('📋 Switch details:', {
            pubkey: switch_.publicKey.toString().slice(0, 8),
            lastPing: new Date(safeBigIntToNumber(switch_.account.lastPing) * 1000).toISOString(),
            encryptedDataLength: switch_.account.dataLength, // Use dataLength field for actual data size
            fixedArraySize: switch_.account.encryptedData.length, // Fixed 512 bytes
            pingInterval: safeBigIntToNumber(switch_.account.pingInterval),
            createdAt: new Date(safeBigIntToNumber(switch_.account.createdAt) * 1000).toISOString()
          })
        })
      }
      
      return validatedSwitches
    } catch (error) {
      console.error('❌ Failed to fetch user switches:', error)
      console.error('🔍 Debug info:', {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        walletConnected: !!wallet.publicKey,
        programConnected: !!program,
        programId: program?.programId?.toString(),
        rpcUrl: connection.rpcEndpoint
      })
      // Re-throw the error so the UI can handle it properly
      throw error
    }
  }

  /**
   * Retrieves all switches from the program with optional limit and enriched data.
   * 
   * Fetches switches from the blockchain, sorts by creation time (newest first),
   * and adds computed properties like expiration status and time calculations.
   * Useful for displaying public switch information and expired switches.
   * 
   * @param limit - Optional maximum number of switches to return
   * @returns Promise resolving to array of enriched switch objects with computed properties
   * @throws Error if program not available or RPC query fails
   */
  const getAllSwitches = async (limit?: number) => {
    if (!program) {
      const error = 'Program not initialized. Check network connection.'
      console.error('❌', error)
      throw new Error(error)
    }

    try {
      const limitText = limit ? ` (limited to ${limit})` : ''
      console.log(`🔍 Fetching switches${limitText} using Anchor deserialization...`)
      
      // Fetch all switches first, then limit and sort
      const allSwitches = await (program.account as any).deadManSwitch.all()
      console.log('🔍 Total switches found:', allSwitches.length)
      
      // Sort by creation time (newest first) and limit if specified
      const sortedSwitches = allSwitches.sort((a: any, b: any) => {
        const aCreated = typeof a.account.createdAt === 'bigint' ? Number(a.account.createdAt) : a.account.createdAt
        const bCreated = typeof b.account.createdAt === 'bigint' ? Number(b.account.createdAt) : b.account.createdAt
        return bCreated - aCreated // Newest first
      })
      
      const limitedSwitches = limit ? sortedSwitches.slice(0, limit) : sortedSwitches
      console.log(`📊 Processing ${limitedSwitches.length} switches${limit ? ` (limited from ${allSwitches.length})` : ''}`)
      
      const currentTime = Math.floor(Date.now() / 1000)
      const enrichedSwitches = []
      
      for (const switch_ of limitedSwitches) {
        try {
          const { account } = switch_
          
          // Safe time calculation with overflow protection
          const lastPing = typeof account.lastPing === 'bigint' ? Number(account.lastPing) : account.lastPing
          const pingInterval = typeof account.pingInterval === 'bigint' ? Number(account.pingInterval) : account.pingInterval
          
          // Check for potential overflow before calculation
          if (lastPing > Number.MAX_SAFE_INTEGER - pingInterval) {
            console.warn('⚠️ Timestamp overflow risk for switch:', switch_.publicKey.toString().slice(0, 8))
            continue
          }
          
          const expirationTime = lastPing + pingInterval
          const isExpired = currentTime > expirationTime
          
          // Add computed properties to the switch for easier use in UI
          const enrichedSwitch = {
            ...switch_,
            computed: {
              isExpired,
              expirationTime,
              timeSinceExpiry: isExpired ? currentTime - expirationTime : 0,
              timeUntilExpiry: !isExpired ? expirationTime - currentTime : 0
            }
          }
          
          enrichedSwitches.push(enrichedSwitch)
        } catch (error) {
          console.warn('Failed to process switch:', switch_.publicKey.toString(), error)
        }
      }
      
      console.log('✅ Processed', enrichedSwitches.length, 'switches')
      return enrichedSwitches
    } catch (error) {
      console.error('❌ Failed to fetch switches:', error)
      console.error('🔍 Debug info:', {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        programConnected: !!program,
        programId: program?.programId?.toString(),
        rpcUrl: connection.rpcEndpoint,
        limit
      })
      // Re-throw the error so the UI can handle it properly
      throw error
    }
  }

  // getExpiredSwitches removed - no longer available in the deployed contract
  // Use getAllSwitches() and filter using getSwitchInfo().expired instead

  /**
   * Efficiently checks if the current user has any switches without fetching full data.
   * 
   * Optimized query that only checks for existence of user switches rather than
   * fetching complete switch data. Useful for determining if a user is a first-time
   * user or for quick availability checks.
   * 
   * @returns Promise resolving to true if user has switches, false otherwise
   * @throws Error if wallet not connected or RPC query fails
   */
  const checkUserHasSwitches = async (): Promise<boolean> => {
    if (!program || !wallet.publicKey) return false

    try {
      console.log('🔍 Checking if user has any switches...')
      
      // Use a minimal query to just check existence
      const userSwitches = await (program.account as any).deadManSwitch.all([
        {
          memcmp: {
            offset: 8, // Skip 8-byte discriminator
            bytes: wallet.publicKey.toBase58(),
          }
        }
      ])
      
      console.log('✅ User has', userSwitches.length, 'switches')
      return userSwitches.length > 0
    } catch (error) {
      console.error('Failed to check user switches:', error)
      return false
    }
  }

  // deactivateSwitch removed - no longer available in the deployed contract
  // Switches now automatically become available for decryption when they expire



  /**
   * Extracts the actual encrypted data from a switch account's fixed-size storage array.
   * 
   * Since encrypted data is stored in a fixed 512-byte array for security reasons,
   * this utility function returns only the portion that contains actual data,
   * as specified by the account's data_length field.
   * 
   * @param account - The switch account object containing encrypted data
   * @returns Uint8Array containing only the actual encrypted data bytes
   */
  const getActualEncryptedData = (account: any): Uint8Array => {
    if (!account.encryptedData || !account.dataLength) {
      return new Uint8Array(0)
    }
    
    // Extract only the actual data based on dataLength
    const actualData = account.encryptedData.slice(0, account.dataLength)
    return new Uint8Array(actualData)
  }

  return {
    program,
    createSwitch,
    pingSwitch,
    checkExpiration,
    batchCheckExpiration,
    getSwitchInfo,
    getSwitchAccount,
    getUserSwitches,
    getAllSwitches,
    checkUserHasSwitches,
    getActualEncryptedData,
    connected: !!program,
  }
}