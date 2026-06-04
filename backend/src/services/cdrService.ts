import { CDRClient, initWasm, uuidToLabel } from '@piplabs/cdr-sdk'
import { createPublicClient, createWalletClient, http, toHex, fallback } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { logger } from '../utils/logger'
import { CONFIG } from '../config/constants'

const PRIVATE_KEY   = (process.env.STORY_PRIVATE_KEY || '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') as `0x${string}`
const RPC_URL       = process.env.STORY_RPC_URL    || 'https://aeneid.storyrpc.io'
const STORY_API_URL = process.env.STORY_API_URL    || 'http://172.192.41.96:1317'

const account = privateKeyToAccount(PRIVATE_KEY)

async function retryWithBackoff<T>(fn: () => Promise<T>, description: string, retries = 3, delayMs = 5000): Promise<T> {
  let lastErr: any
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const isRetryable = err.message?.toLowerCase().includes('timeout') ||
                          err.message?.toLowerCase().includes('took too long') ||
                          err.message?.toLowerCase().includes('abort') ||
                          err.message?.toLowerCase().includes('network') ||
                          err.message?.toLowerCase().includes('fetch') ||
                          err.message?.toLowerCase().includes('rpc') ||
                          err.status === 408 ||
                          err.status === 504 ||
                          err.status === 429
      if (isRetryable && i < retries - 1) {
        logger.warn(`[CDR] ${description} failed (attempt ${i + 1}/${retries}) due to: ${err.message}. Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

class CDRService {
  private clientPromise: Promise<CDRClient>

  constructor() {
    this.clientPromise = this.init()
  }

  private async init(): Promise<CDRClient> {
    if (CONFIG.STORY_PROVIDER === 'real' && !process.env.STORY_PRIVATE_KEY) {
      throw new Error('[CDR] STORY_PRIVATE_KEY is required when STORY_PROVIDER is real')
    }
    await initWasm()
    logger.info('[CDR] WASM initialised')

    const transport = fallback([
      http(RPC_URL, { timeout: 120000 }),
      http('https://rpc.ankr.com/story_aeneid_testnet', { timeout: 120000 })
    ])
    const publicClient = createPublicClient({ transport })
    const walletClient = createWalletClient({ account, transport })

    const client = new CDRClient({
      network: 'testnet',
      publicClient,
      walletClient,
      apiUrl: STORY_API_URL,
    })
    logger.info(`[CDR] Client ready — TEE=${account.address}`)
    return client
  }

  private async getClient(): Promise<CDRClient> {
    return this.clientPromise
  }

  async sealCID(pinataCid: string): Promise<string> {
    const client = await this.getClient()

    logger.info(`[CDR] Allocating vault for CID: ${pinataCid.slice(0, 16)}...`)
    const { uuid, txHash: allocateTx } = await retryWithBackoff(
      () => client.uploader.allocate({
        updatable: false,
        writeConditionAddr: account.address,
        readConditionAddr:  account.address,
        writeConditionData: '0x',
        readConditionData:  '0x',
        skipConditionValidation: true,
      }),
      'Vault allocation'
    )
    logger.info(`[CDR] Vault allocated uuid=${uuid} tx=${allocateTx.slice(0, 18)}...`)

    const globalPubKey = await retryWithBackoff(
      () => client.observer.getGlobalPubKey(),
      'Get global pubkey'
    )
    const cidBytes     = Buffer.from(pinataCid, 'utf8')

    const ciphertext = await client.uploader.encryptDataKey({
      dataKey:      cidBytes,
      globalPubKey,
      label:        uuidToLabel(uuid),
    })

    logger.info(`[CDR] Writing encrypted CID data for uuid=${uuid}`)
    const { txHash: writeTx } = await retryWithBackoff(
      () => client.uploader.write({
        uuid,
        accessAuxData: '0x',
        encryptedData: toHex(ciphertext.raw),
      }),
      'Vault write'
    )
    logger.info(`[CDR] CID sealed uuid=${uuid} tx=${writeTx.slice(0, 18)}...`)
    return String(uuid)
  }

  async unsealCID(vaultUUID: string): Promise<string> {
    const client = await this.getClient()
    logger.info(`[CDR] Unsealing vault uuid=${vaultUUID}`)

    const { dataKey, txHash } = await retryWithBackoff(
      () => client.consumer.accessCDR({
        uuid:          Number(vaultUUID),
        accessAuxData: '0x',
        timeoutMs:     120_000,
      }),
      'Access CDR (unseal)'
    )

    const pinataCid = Buffer.from(dataKey).toString('utf8')
    logger.info(`[CDR] Unsealed tx=${txHash.slice(0, 18)}... cid=${pinataCid.slice(0, 16)}...`)
    return pinataCid
  }

  get teeAddress(): string { return account.address }
}

export const cdrService = new CDRService()

