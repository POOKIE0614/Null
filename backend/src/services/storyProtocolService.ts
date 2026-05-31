import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import { StoryClient } from '@story-protocol/core-sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { IPAsset, License, LicenseType, IStoryService } from '../types'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const PRIVATE_KEY    = process.env.STORY_PRIVATE_KEY as `0x${string}`
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

if (!PRIVATE_KEY) throw new Error('[Story] STORY_PRIVATE_KEY not set')

const account      = privateKeyToAccount(PRIVATE_KEY)
const publicClient = createPublicClient({ transport: http(RPC_URL) })
const walletClient = createWalletClient({ account, transport: http(RPC_URL) })
const client       = StoryClient.newClient({ account, transport: http(RPC_URL), chainId: 'aeneid' })

logger.info(`[Story] Wallet: ${account.address}  RPC: ${RPC_URL}`)

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

  constructor() { this.loadDB() }

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

    const reg = await client.ipAsset.mintAndRegisterIp({
      spgNftContract: SPG_CONTRACT,
      ipMetadata: {
        ipMetadataURI: metaUri, ipMetadataHash: metaHash,
        nftMetadataURI: metaUri, nftMetadataHash: metaHash,
      },
      txOptions: { waitForTransaction: true },
    })

    const ipId   = reg.ipId   as string
    const txHash = reg.txHash as string
    logger.info(`[Story] IP registered ipId=${ipId}`)

    await client.license.attachLicenseTerms({
      ipId:           ipId as `0x${string}`,
      licenseTermsId: PIL_TERMS[params.licenseType],
      txOptions:      { waitForTransaction: true },
    })
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

  async purchaseLicense(ipAssetId: string, buyerWallet: string): Promise<{ txHash: string; licenseId: string }> {
    const asset = this.getAssetById(ipAssetId)
    if (!asset) throw new Error(`IP asset not found: ${ipAssetId}`)
    if (asset.creatorWallet.toLowerCase() === buyerWallet.toLowerCase())
      throw new Error('Creator cannot purchase own asset')

    const res = await client.license.mintLicenseTokens({
      licenseTermsId: PIL_TERMS[asset.licenseType],
      licensorIpId:   asset.ipId as `0x${string}`,
      receiver:       buyerWallet as `0x${string}`,
      amount:         BigInt(1),
      txOptions:      { waitForTransaction: true },
    })

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
}

export const storyProtocolService = new StoryProtocolService()
export { storyProtocolService as mockStoryService }
