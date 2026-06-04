import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import type { StoryClient } from '@story-protocol/core-sdk'
import { createPublicClient, createWalletClient, http, fallback } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { IPAsset, License, LicenseType, IStoryService, TeamSettings } from '../types'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const PRIVATE_KEY    = (process.env.STORY_PRIVATE_KEY || '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') as `0x${string}`
const RPC_URL        = process.env.STORY_RPC_URL    || 'https://aeneid.storyrpc.io'
const PINATA_JWT     = process.env.PINATA_JWT!
const PINATA_GATEWAY = process.env.PINATA_GATEWAY   || 'https://gateway.pinata.cloud'
const PINATA_API     = 'https://api.pinata.cloud'
const SPG_CONTRACT   = (process.env.STORY_SPG_CONTRACT || '0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc') as `0x${string}`
const SERVER_URL     = process.env.SERVER_URL        || 'http://localhost:4000'

const PIL_TERMS: Record<LicenseType, bigint> = {
  'non-commercial': BigInt(process.env.STORY_PIL_NON_COMMERCIAL_ID || '1'),
  'commercial':     BigInt(process.env.STORY_PIL_COMMERCIAL_ID     || '2'),
  'exclusive':      BigInt(process.env.STORY_PIL_EXCLUSIVE_ID      || '3'),
}

const account      = privateKeyToAccount(PRIVATE_KEY)
const transport = fallback([
  http(RPC_URL, { timeout: 120000 }),
  http('https://rpc.ankr.com/story_aeneid_testnet', { timeout: 120000 })
])

const publicClient = createPublicClient({ transport })
const walletClient = createWalletClient({ account, transport })

logger.info(`[Story] Wallet: ${account.address}  RPC: ${RPC_URL}`)

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
        logger.warn(`[Story] ${description} failed (attempt ${i + 1}/${retries}) due to: ${err.message}. Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      throw err
    }
  }
  throw lastErr
}


const DB_PATH = path.resolve(CONFIG.DATA_DIR, 'db.json')
interface DB { ipAssets: Record<string, IPAsset>; licenses: Record<string, License> }

async function pinMetadata(content: object, name: string): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name, keyvalues: { app: 'nullvault' } },
      pinataOptions: { cidVersion: 1 },
    }),
  })
  if (!res.ok) throw new Error(`Pinata meta pin failed (${res.status})`)
  const { IpfsHash } = await res.json() as { IpfsHash: string }
  return IpfsHash
}

class StoryProtocolService implements IStoryService {
  private db: DB = { ipAssets: {}, licenses: {} }
  private client: StoryClient | null = null

  private async getClient(): Promise<StoryClient> {
    if (!this.client) {
      const { StoryClient } = await import('@story-protocol/core-sdk')
      this.client = StoryClient.newClient({ account, transport, chainId: 'aeneid' })
    }
    return this.client
  }

  constructor() {
    if (CONFIG.STORY_PROVIDER === 'real' && !process.env.STORY_PRIVATE_KEY) {
      throw new Error('[Story] STORY_PRIVATE_KEY is required when STORY_PROVIDER is real')
    }
    this.loadDB()
  }

  private loadDB(): void {
    if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    if (fs.existsSync(DB_PATH)) {
      try { this.db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) }
      catch { this.db = { ipAssets: {}, licenses: {} } }
    }
  }

  private saveDB(): void { fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2)) }

  async registerIPAsset(params: {
    title: string; description: string; creatorWallet: string; mimeType: string
    originalName: string; totalSize: number; licenseType: LicenseType
    priceUSD: number; locationMapCid: string
    isTeamIP?: boolean
    teamSettings?: TeamSettings
  }): Promise<{ ipId: string; txHash: string }> {

    if (CONFIG.STORY_PROVIDER === 'mock') {
      const mockIpId = `0x${crypto.randomBytes(20).toString('hex')}`
      const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`
      logger.info(`[Story] [MOCK] Registering IP Asset: "${params.title}" -> ipId=${mockIpId}`)
      
      const id = uuidv4()
      this.db.ipAssets[id] = {
        id, ipId: mockIpId, txHash: mockTxHash, title: params.title, description: params.description,
        creatorWallet: params.creatorWallet, mimeType: params.mimeType,
        originalName: params.originalName, totalSize: params.totalSize,
        licenseType: params.licenseType, priceUSD: params.priceUSD,
        locationMapCid: params.locationMapCid, registeredAt: new Date().toISOString(),
        downloadCount: 0, royaltiesEarned: 0,
        isTeamIP: params.isTeamIP,
        teamSettings: params.teamSettings,
      }
      this.saveDB()
      return { ipId: mockIpId, txHash: mockTxHash }
    }

    // Pin IP metadata to IPFS
    const meta = {
      title: params.title, description: params.description,
      image: `${PINATA_GATEWAY}/ipfs/${params.locationMapCid}`,
      mediaType: params.mimeType,
      creators: [{ address: params.creatorWallet, contributionPercent: 100 }],
      attributes: [
        { trait_type: 'File', value: params.originalName },
        { trait_type: 'Size', value: String(params.totalSize) },
        { trait_type: 'License', value: params.licenseType },
        { trait_type: 'Price USD', value: String(params.priceUSD) },
        { trait_type: 'Location Map', value: params.locationMapCid },
        { trait_type: 'TEE', value: `${SERVER_URL}/api/tee` },
      ],
    }
    const metaCid  = await pinMetadata(meta, `NullVault-IP-${params.title}`)
    const metaHash = `0x${crypto.createHash('sha256').update(JSON.stringify(meta)).digest('hex')}` as `0x${string}`
    const metaUri  = `${PINATA_GATEWAY}/ipfs/${metaCid}`

    logger.info(`[Story] Registering IP: "${params.title}"`)

    const client = await this.getClient()

    const reg = await retryWithBackoff(
      () => client.ipAsset.mintAndRegisterIp({
        spgNftContract: SPG_CONTRACT,
        ipMetadata: {
          ipMetadataURI: metaUri, ipMetadataHash: metaHash,
          nftMetadataURI: metaUri, nftMetadataHash: metaHash,
        },
        txOptions: { waitForTransaction: true } as any,
      }),
      `Register IP: "${params.title}"`
    )

    const ipId   = reg.ipId   as string
    const txHash = reg.txHash as string
    logger.info(`[Story] IP registered ipId=${ipId}`)

    await retryWithBackoff(
      () => client.license.attachLicenseTerms({
        ipId:           ipId as `0x${string}`,
        licenseTermsId: PIL_TERMS[params.licenseType],
        txOptions:      { waitForTransaction: true } as any,
      }),
      `Attach License Terms for IP ${ipId}`
    )
    logger.info(`[Story] PIL terms attached (${params.licenseType})`)

    const id = uuidv4()
    this.db.ipAssets[id] = {
      id, ipId, txHash, title: params.title, description: params.description,
      creatorWallet: params.creatorWallet, mimeType: params.mimeType,
      originalName: params.originalName, totalSize: params.totalSize,
      licenseType: params.licenseType, priceUSD: params.priceUSD,
      locationMapCid: params.locationMapCid, registeredAt: new Date().toISOString(),
      downloadCount: 0, royaltiesEarned: 0,
      isTeamIP: params.isTeamIP,
      teamSettings: params.teamSettings,
    }
    this.saveDB()
    return { ipId, txHash }
  }

  async confirmRegistration(params: {
    ipId: string; txHash: string; title: string; description: string
    creatorWallet: string; mimeType: string; originalName: string
    totalSize: number; licenseType: LicenseType; priceUSD: number
    locationMapCid: string; isTeamIP?: boolean; teamSettings?: any
  }): Promise<void> {
    const id = uuidv4()
    this.db.ipAssets[id] = {
      id, ipId: params.ipId, txHash: params.txHash,
      title: params.title, description: params.description,
      creatorWallet: params.creatorWallet, mimeType: params.mimeType,
      originalName: params.originalName, totalSize: params.totalSize,
      licenseType: params.licenseType, priceUSD: params.priceUSD,
      locationMapCid: params.locationMapCid, registeredAt: new Date().toISOString(),
      downloadCount: 0, royaltiesEarned: 0,
      isTeamIP: params.isTeamIP,
      teamSettings: params.teamSettings,
    }
    this.saveDB()
    logger.info(`[Story] Confirmed on-chain registration ipId=${params.ipId}`)
  }

  async purchaseLicense(ipAssetId: string, buyerWallet: string): Promise<{ txHash: string; licenseId: string }> {
    const asset = this.getAssetById(ipAssetId)
    if (!asset) throw new Error(`IP asset not found: ${ipAssetId}`)
    if (asset.creatorWallet.toLowerCase() === buyerWallet.toLowerCase())
      throw new Error('Creator cannot purchase own asset')

    if (CONFIG.STORY_PROVIDER === 'mock') {
      const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`
      const licenseId = uuidv4()
      this.db.licenses[licenseId] = {
        id: licenseId, ipAssetId: asset.id, buyerWallet,
        purchasedAt: new Date().toISOString(), expiresAt: null,
        txHash: mockTxHash, pricePaid: asset.priceUSD,
      }
      this.db.ipAssets[asset.id].royaltiesEarned += asset.priceUSD
      this.saveDB()
      logger.info(`[Story] [MOCK] License minted licenseId=${licenseId}`)
      return { txHash: mockTxHash, licenseId }
    }

    const client = await this.getClient()

    const res = await retryWithBackoff(
      () => client.license.mintLicenseTokens({
        licenseTermsId: PIL_TERMS[asset.licenseType],
        licensorIpId:   asset.ipId as `0x${string}`,
        receiver:       buyerWallet as `0x${string}`,
        amount:         BigInt(1),
        txOptions:      { waitForTransaction: true } as any,
      }),
      `Purchase License for IP ${asset.id}`
    )

    const txHash    = res.txHash as string
    const licenseId = uuidv4()

    this.db.licenses[licenseId] = {
      id: licenseId, ipAssetId: asset.id, buyerWallet,
      purchasedAt: new Date().toISOString(), expiresAt: null,
      txHash, pricePaid: asset.priceUSD,
    }
    this.db.ipAssets[asset.id].royaltiesEarned += asset.priceUSD
    this.saveDB()
    logger.info(`[Story] License minted licenseId=${licenseId}`)
    return { txHash, licenseId }
  }

  async verifyLicense(ipAssetId: string, walletAddress: string): Promise<boolean> {
    const asset = this.getAssetById(ipAssetId)
    if (!asset) return false
    const valid = Object.values(this.db.licenses).find(l =>
      l.ipAssetId === asset.id &&
      l.buyerWallet.toLowerCase() === walletAddress.toLowerCase() &&
      (l.expiresAt === null || new Date(l.expiresAt) > new Date())
    )
    return !!valid
  }

  getAllAssets(): IPAsset[] {
    return Object.values(this.db.ipAssets).sort((a, b) =>
      new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    )
  }

  getAssetById(id: string): IPAsset | undefined {
    return this.db.ipAssets[id] ?? Object.values(this.db.ipAssets).find(a => a.ipId === id)
  }

  getAssetsByCreator(wallet: string): IPAsset[] {
    return Object.values(this.db.ipAssets).filter(a => a.creatorWallet.toLowerCase() === wallet.toLowerCase())
  }

  getLicensesByBuyer(wallet: string): Array<License & { asset: IPAsset | undefined }> {
    return Object.values(this.db.licenses)
      .filter(l => l.buyerWallet.toLowerCase() === wallet.toLowerCase())
      .map(l => ({ ...l, asset: this.getAssetById(l.ipAssetId) }))
  }

  incrementDownload(assetId: string): void {
    if (this.db.ipAssets[assetId]) { this.db.ipAssets[assetId].downloadCount++; this.saveDB() }
  }

  updateAssetLocationMap(assetId: string, newLocationMapCid: string): void {
    const asset = this.db.ipAssets[assetId] ?? Object.values(this.db.ipAssets).find(a => a.ipId === assetId)
    if (!asset) throw new Error(`IP Asset not found in database: ${assetId}`)
    asset.locationMapCid = newLocationMapCid
    asset.lastReshuffledAt = new Date().toISOString()
    this.saveDB()
    logger.info(`[Story] Updated asset ${assetId} with reshuffled Location Map CID: ${newLocationMapCid}`)
  }
}

import { mockStoryService } from './mockStoryService'

export const storyProtocolService = CONFIG.STORY_PROVIDER === 'real'
  ? new StoryProtocolService()
  : mockStoryService
