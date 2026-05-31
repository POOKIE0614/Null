import crypto from 'crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const PRIVATE_KEY = process.env.STORY_PRIVATE_KEY as `0x${string}`
if (!PRIVATE_KEY) throw new Error('[TEE] STORY_PRIVATE_KEY not set')

const account     = privateKeyToAccount(PRIVATE_KEY)
const TEE_ADDRESS = account.address
const TEE_VERSION = 'nullvault-tee-1.0'

const AUDIT_LOG_PATH   = path.resolve(CONFIG.DATA_DIR, 'tee-audit.jsonl')
const RECEIPTS_DIR     = path.resolve(CONFIG.DATA_DIR, 'receipts')
const ATTESTATION_PATH = path.resolve(CONFIG.DATA_DIR, 'attestation.json')

export interface TEEAttestation {
  enclaveId: string; teeAddress: string; teeVersion: string
  startedAt: string; signature: string
}

export interface ReconstructionReceipt {
  receiptId: string; sessionId: string; assetId: string; ipId: string
  buyerWallet: string; fileHash: string; fileSizeBytes: number
  reconstructedAt: string; deliveredAt: string | null; memoryCleared: boolean
  teeAddress: string; signature: string
}

export interface SignedDownloadToken {
  tokenId: string; receiptId: string; assetId: string
  buyerWallet: string; expiresAt: number; hmac: string
}

class TEEService {
  private attestation!: TEEAttestation
  private readonly receipts = new Map<string, ReconstructionReceipt>()
  private readonly startedAt = new Date().toISOString()

  constructor() {
    this.ensureDirs()
    this.initAttestation().catch(e => logger.error('[TEE] Attestation init failed:', e))
  }

  private ensureDirs(): void {
    for (const d of [CONFIG.DATA_DIR, RECEIPTS_DIR]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    }
  }

  private async initAttestation(): Promise<void> {
    if (fs.existsSync(ATTESTATION_PATH)) {
      try {
        const saved = JSON.parse(fs.readFileSync(ATTESTATION_PATH, 'utf8')) as TEEAttestation
        if (saved.startedAt === this.startedAt) {
          this.attestation = saved
          logger.info(`[TEE] Attestation loaded enclave=${saved.enclaveId.slice(0, 12)}...`)
          return
        }
      } catch { /* generate fresh */ }
    }

    const enclaveId = crypto.createHash('sha256')
      .update(PRIVATE_KEY + this.startedAt).digest('hex')

    const payload  = JSON.stringify({ enclaveId, teeAddress: TEE_ADDRESS, teeVersion: TEE_VERSION, startedAt: this.startedAt })
    const signature = await account.signMessage({ message: payload })

    this.attestation = { enclaveId, teeAddress: TEE_ADDRESS, teeVersion: TEE_VERSION, startedAt: this.startedAt, signature }
    fs.writeFileSync(ATTESTATION_PATH, JSON.stringify(this.attestation, null, 2))
    this.appendAudit({ event: 'TEE_STARTED', enclaveId, teeAddress: TEE_ADDRESS })
    logger.info(`[TEE] Attestation generated enclave=${enclaveId.slice(0, 12)}...`)
  }

  async getAttestation(): Promise<TEEAttestation> {
    let tries = 0
    while (!this.attestation && tries++ < 30) await new Promise(r => setTimeout(r, 100))
    if (!this.attestation) throw new Error('[TEE] Attestation not ready')
    return this.attestation
  }

  createDownloadToken(params: { receiptId: string; assetId: string; buyerWallet: string; ttlMs?: number }): string {
    const tokenId   = uuidv4()
    const expiresAt = Date.now() + (params.ttlMs ?? 5 * 60_000)
    const payload: Omit<SignedDownloadToken, 'hmac'> = {
      tokenId, receiptId: params.receiptId, assetId: params.assetId,
      buyerWallet: params.buyerWallet, expiresAt,
    }
    const hmac = crypto.createHmac('sha256', PRIVATE_KEY).update(JSON.stringify(payload)).digest('hex')
    return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url')
  }

  verifyDownloadToken(tokenB64: string): SignedDownloadToken | null {
    try {
      const token  = JSON.parse(Buffer.from(tokenB64, 'base64url').toString('utf8')) as SignedDownloadToken
      if (Date.now() > token.expiresAt) return null
      const { hmac, ...payload } = token
      const expected = crypto.createHmac('sha256', PRIVATE_KEY).update(JSON.stringify(payload)).digest('hex')
      return hmac === expected ? token : null
    } catch { return null }
  }

  async createReceipt(params: {
    sessionId: string; assetId: string; ipId: string
    buyerWallet: string; fileHash: string; fileSizeBytes: number
  }): Promise<ReconstructionReceipt> {
    const receiptId       = uuidv4()
    const reconstructedAt = new Date().toISOString()
    const base = { receiptId, ...params, reconstructedAt, teeAddress: TEE_ADDRESS }
    const signature = await account.signMessage({ message: JSON.stringify(base) })

    const receipt: ReconstructionReceipt = {
      ...base, deliveredAt: null, memoryCleared: false, signature,
    }
    this.receipts.set(receiptId, receipt)
    this.writeReceipt(receipt)
    this.appendAudit({ event: 'FILE_RECONSTRUCTED', receiptId, assetId: params.assetId, buyerWallet: params.buyerWallet })
    logger.info(`[TEE] Receipt signed receiptId=${receiptId.slice(0, 8)}...`)
    return receipt
  }

  markDelivered(receiptId: string): void {
    const r = this.receipts.get(receiptId)
    if (!r) return
    r.deliveredAt   = new Date().toISOString()
    r.memoryCleared = true
    this.writeReceipt(r)
    this.appendAudit({ event: 'FILE_DELIVERED_AND_CLEARED', receiptId, deliveredAt: r.deliveredAt })
  }

  getReceipt(receiptId: string): ReconstructionReceipt | undefined {
    if (this.receipts.has(receiptId)) return this.receipts.get(receiptId)
    const fp = path.join(RECEIPTS_DIR, `${receiptId}.json`)
    if (fs.existsSync(fp)) {
      try {
        const r = JSON.parse(fs.readFileSync(fp, 'utf8')) as ReconstructionReceipt
        this.receipts.set(receiptId, r)
        return r
      } catch { return undefined }
    }
    return undefined
  }

  secureClear(buffer: Buffer): void {
    try { crypto.randomFillSync(buffer); buffer.fill(0) }
    catch (e) { logger.error('[TEE] secureClear error:', e) }
  }

  createSessionId(): string { return uuidv4() }
  get address(): string { return TEE_ADDRESS }

  private appendAudit(data: Record<string, unknown>): void {
    try {
      fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify({ timestamp: new Date().toISOString(), teeAddress: TEE_ADDRESS, ...data }) + '\n')
    } catch { /* non-critical */ }
  }

  private writeReceipt(receipt: ReconstructionReceipt): void {
    try { fs.writeFileSync(path.join(RECEIPTS_DIR, `${receipt.receiptId}.json`), JSON.stringify(receipt, null, 2)) }
    catch { /* non-critical */ }
  }
}

export const teeService = new TEEService()
