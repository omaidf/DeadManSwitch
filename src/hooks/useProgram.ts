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

export function useProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const config = getConfig()

  const program = useMemo(() => {
    if (!wallet.publicKey) return null

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: 'confirmed'
      })
      
      console.log('🔧 Provider ready:', !!provider)
      console.log('🔧 IDL loaded:', !!IDL)
      console.log('🔧 IDL address:', (IDL as any).address || (IDL as any).metadata?.address)
      
      // For Anchor v0.26.0, pass the address explicitly  
      const anchorProgramId = new PublicKey(config.PROGRAM_ID)
      const program = new Program(IDL, anchorProgramId, provider)
      console.log('✅ Program initialized successfully with address:', program.programId.toString())
      return program
    } catch (error) {
      console.error('❌ Failed to create program:', error)
      return null
    }
  }, [connection, wallet, config.PROGRAM_ID])

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
        if ('logs' in error) {
          console.error('  - Program logs:', (error as any).logs)
          // Log each program log individually for better readability
          if (Array.isArray((error as any).logs)) {
            (error as any).logs.forEach((log: string, index: number) => {
              console.error(`    [${index}]: ${log}`)
            })
          }
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
      
      throw error
    }
  }

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
      return false
    }
  }

  const getSwitchInfo = async (switchPDA: PublicKey) => {
    if (!program) {
      throw new Error('Program not available')
    }

    try {
      // Use account fetching directly instead of .view() method
      const accountInfo = await (program.account as any).deadManSwitch.fetch(switchPDA)
      return accountInfo
    } catch (error) {
      console.error('Failed to get switch info:', error)
      throw error
    }
  }

  const getUserSwitches = async () => {
    if (!program || !wallet.publicKey) return []

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
        validatedSwitches.forEach((switch_: any) => {
          console.log('✅ User switch:', {
            pubkey: switch_.publicKey.toString().slice(0, 8),
            active: switch_.account.active,
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
      console.error('Failed to fetch user switches:', error)
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        walletConnected: !!wallet.publicKey,
        programConnected: !!program
      })
      return []
    }
  }

  const getAllSwitches = async (limit?: number) => {
    if (!program) return []

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
      console.error('Failed to fetch switches:', error)
      return []
    }
  }

  const getExpiredSwitches = async () => {
    if (!program) return []

    try {
      console.log('🔍 Fetching expired switches using Anchor deserialization...')
      
      // Get all switches and filter for expired ones
      const allSwitches = await getAllSwitches()
      const expiredSwitches = allSwitches.filter(switch_ => switch_.computed.isExpired)
      
      console.log('✅ Found', expiredSwitches.length, 'expired switches out of', allSwitches.length, 'total')
      return expiredSwitches
    } catch (error) {
      console.error('Failed to fetch expired switches:', error)
      return []
    }
  }

  // 🎯 OPTIMIZED: Just check if user has any switches without fetching full data
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

  const deactivateSwitch = async (switchPDA: PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Program or wallet not available')
    }

    try {
      const tx = await program.methods
        .deactivateSwitch()
        .accounts({
          switch: switchPDA,
          owner: wallet.publicKey,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Failed to deactivate switch:', error)
      throw error
    }
  }

  const closeSwitch = async (switchPDA: PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Program or wallet not available')
    }

    try {
      const tx = await program.methods
        .closeSwitch()
        .accounts({
          switch: switchPDA,
          owner: wallet.publicKey,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Failed to close switch:', error)
      throw error
    }
  }

  // Utility function to extract actual encrypted data from fixed array
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
    getSwitchInfo,
    getUserSwitches,
    getAllSwitches,
    getExpiredSwitches,
    checkUserHasSwitches,
    deactivateSwitch,
    closeSwitch,
    getActualEncryptedData,
    connected: !!program,
  }
}