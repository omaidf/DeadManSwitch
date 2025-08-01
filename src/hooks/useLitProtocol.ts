import { useState, useEffect } from 'react'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { useWallet } from '@solana/wallet-adapter-react'
import { getConfig } from '../lib/config'

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

  useEffect(() => {
    const initLit = async () => {
      if (litNodeClient || isConnecting) return

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
        console.log('🔗 Using Lit SDK v7+ with datil-dev support')
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
          method: "getAccountInfo(getPDA)", // Get PDA and check its state
          params: [], // Empty because we're using PDA derivation
          pdaParams: [
            config.PROGRAM_ID, // Program ID
            "switch", // Seed string (must match lib.rs: b"switch")
            wallet.publicKey!.toString(), // Owner wallet (owner.key.as_ref())
            actualSwitchId // Switch ID (consistent with CreatePage)
          ],
          pdaInterface: { 
            offset: 0, // Start from beginning of account data
            fields: {
              // Based on lib.rs DeadManSwitch struct:
              // discriminator(8) + owner(32) + last_ping(8) + ping_interval(8) + encrypted_data(4+len) + created_at(8) + active(1) + bump(1)
              "discriminator": { type: "bytes", offset: 0, length: 8 }, // 0-7: discriminator
              "owner": { type: "pubkey", offset: 8 },      // 8-39: owner (32 bytes)
              "last_ping": { type: "i64", offset: 40 },    // 40-47: last_ping (8 bytes)
              "ping_interval": { type: "i64", offset: 48 }, // 48-55: ping_interval (8 bytes)
              // encrypted_data starts at 56 with 4-byte length prefix, then variable data
              // created_at is 8 bytes before the end (after encrypted_data)
              // active is 2 bytes from the end (1 byte before bump)
              "is_active": { type: "bool", offset: -2 }    // Second to last byte (active field)
            } 
          },
          pdaKey: "is_active", // Check the is_active field
          chain: "solana",
          returnValueTest: {
            key: "is_active", // Key condition: switch must be INACTIVE (expired)
            comparator: "=",
            value: "false" // false = expired/inactive = message can be decrypted
          }
        }
      ]

      // Switch metadata is embedded in compact format

      // Use Lit's encryption with proper Solana RPC conditions
      const { ciphertext, dataToEncryptHash } = await litNodeClient.encrypt({
        dataToEncrypt: new TextEncoder().encode(message),
        solRpcConditions, // Use Solana RPC conditions instead of accessControlConditions
      })

      // Compress the encrypted data to fit within 512 byte program limit
      const ciphertextBase64 = Buffer.from(ciphertext).toString('base64')
      
      // Create compact encrypted data structure
      const compactEncryptedData = {
        c: ciphertextBase64, // Ciphertext (shortened key)
        h: dataToEncryptHash, // Hash (shortened key)
        s: actualSwitchId, // Switch ID for PDA derivation
        p: config.PROGRAM_ID, // Program ID
        w: wallet.publicKey!.toString(), // Wallet
        t: Date.now() // Timestamp
      }

      console.log('✅ Message encrypted with Dead Man\'s Switch logic')
      console.log('🔧 Switch will unlock when is_active = false (expired)')
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

  const decryptMessage = async (
    encryptedString: string, 
    encryptedSymmetricKey?: string,
    _switchId?: string // Underscore prefix indicates intentionally unused parameter
  ): Promise<string> => {
    if (!litNodeClient) {
      throw new Error('Lit Protocol not connected')
    }

    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error('Wallet not connected')
    }

    try {
      // Parse the encrypted data - handle both compact and full formats
      let encryptedData: any
      let switchId: string
      
      try {
        const parsed = JSON.parse(encryptedString)
        
        // Handle compact format (new format)
        if (parsed.c && parsed.h && parsed.s) {
          switchId = parsed.s
          encryptedData = {
            ciphertext: parsed.c,
            dataToEncryptHash: parsed.h,
            switchId: parsed.s
          }
        } 
        // Handle full format (legacy)
        else if (parsed.ciphertext && parsed.dataToEncryptHash) {
          switchId = parsed.switchMetadata?.switchId || parsed.s || Date.now().toString()
          encryptedData = {
            ciphertext: parsed.ciphertext,
            dataToEncryptHash: parsed.dataToEncryptHash,
            switchId: switchId
          }
        }
        // Handle ultra-compact format
        else {
          throw new Error('Unknown encrypted data format')
        }
      } catch {
        // Fallback for raw format
        switchId = _switchId || Date.now().toString()
        encryptedData = {
          ciphertext: encryptedString,
          dataToEncryptHash: encryptedSymmetricKey,
          switchId: switchId
        }
      }

      // Create the proper Solana RPC conditions for decryption
      const solRpcConditions = [
        {
          method: "getAccountInfo(getPDA)",
          params: [],
          pdaParams: [
            config.PROGRAM_ID,
            "switch", // Fixed to match lib.rs
            wallet.publicKey!.toString(),
            switchId
          ],
          pdaInterface: { 
            offset: 0,
            fields: {
              "is_active": { type: "bool", offset: -2 } // Second to last byte
            } 
          },
          pdaKey: "is_active",
          chain: "solana",
          returnValueTest: {
            key: "is_active",
            comparator: "=",
            value: "false" // Only decrypt when switch is expired
          }
        }
      ]

      console.log('🔓 Decrypting message for expired switch:', switchId)

      // Use Lit Protocol to decrypt the message with Solana RPC conditions
      const decryptedData = await litNodeClient.decrypt({
        ciphertext: Buffer.from(encryptedData.ciphertext, 'base64'),
        dataToEncryptHash: encryptedData.dataToEncryptHash,
        solRpcConditions, // Use dynamically created Solana RPC conditions
      })

      const decryptedMessage = new TextDecoder().decode(decryptedData.decryptedData)
      console.log('✅ Message decrypted successfully with Lit Protocol')
      
      return decryptedMessage
    } catch (err) {
      console.error('❌ Decryption failed:', err)
      throw new Error(err instanceof Error ? err.message : 'Decryption failed')
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
  }
}