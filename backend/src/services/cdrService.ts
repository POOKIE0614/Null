import { CDRClient, initWasm, uuidToLabel } from '@piplabs/cdr-sdk'
import { createPublicClient, createWalletClient, http, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { logger } from '../utils/logger'

const PRIVATE_KEY   = process.env.STORY_PRIVATE_KEY as `0x${string}`
const RPC_URL       = process.env.STORY_RPC_URL    || 'https://aeneid.storyrpc.io'
const STORY_API_URL = process.env.STORY_API_URL    || 'http://172.192.41.96:1317'

if (!PRIVATE_KEY) throw new Error('[CDR] STORY_PRIVATE_KEY not set')

const account = privateKeyToAccount(PRIVATE_KEY)

class CDRService {
  private clientPromise: Promise<CDRClient>

  constructor() {
    this.clientPromise = this.init()
  }

  private async init(): Promise<CDRClient> {
    await initWasm()
    logger.info('[CDR] WASM initialised')

    const publicClient = createPublicClient({ transport: http(RPC_URL) })
    const walletClient = createWalletClient({ account, transport: http(RPC_URL) })

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

    const { uuid, txHash: allocateTx } = await client.uploader.allocate({
      updatable: false,
      writeConditionAddr: account.address,
      readConditionAddr:  account.address,
      writeConditionData: '0x',
      readConditionData:  '0x',
      skipConditionValidation: true,
    })
    logger.info(`[CDR] Vault allocated uuid=${uuid} tx=${allocateTx.slice(0, 18)}...`)

    const globalPubKey = await client.observer.getGlobalPubKey()
    const cidBytes     = Buffer.from(pinataCid, 'utf8')

    const ciphertext = await client.uploader.encryptDataKey({
      dataKey:      cidBytes,
      globalPubKey,
      label:        uuidToLabel(uuid),
    })

    const { txHash: writeTx } = await client.uploader.write({
      uuid,
      accessAuxData: '0x',
      encryptedData: toHex(ciphertext.raw),
    })
    logger.info(`[CDR] CID sealed uuid=${uuid} tx=${writeTx.slice(0, 18)}...`)
    return uuid
  }

  async unsealCID(vaultUUID: string): Promise<string> {
    const client = await this.getClient()
    logger.info(`[CDR] Unsealing vault uuid=${vaultUUID}`)

    const { dataKey, txHash } = await client.consumer.accessCDR({
      uuid:          vaultUUID,
      accessAuxData: '0x',
      timeoutMs:     120_000,
    })

    const pinataCid = Buffer.from(dataKey).toString('utf8')
    logger.info(`[CDR] Unsealed tx=${txHash.slice(0, 18)}... cid=${pinataCid.slice(0, 16)}...`)
    return pinataCid
  }

  get teeAddress(): string { return account.address }
}

export const cdrService = new CDRService()
