import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { IPAsset, License, IStoryService, LicenseType, TeamSettings } from '../types'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const DB_PATH = path.resolve(CONFIG.DATA_DIR, 'db.json')

interface MockDB {
  ipAssets: Record<string, IPAsset>
  licenses: Record<string, License>
}

/**
 * MOCK Story Protocol service.
 * Persists IP assets and licenses to a local JSON "database".
 *
 * SWAP INSTRUCTION:
 * 1. Create `src/services/storyProtocolService.ts` implementing IStoryService
 * 2. Use @story-protocol/core-sdk with real wallet and Aeneid RPC
 * 3. Change import in vaultService.ts
 * 4. Set STORY_PROVIDER=real in .env
 */
export class MockStoryService implements IStoryService {
  private db: MockDB = { ipAssets: {}, licenses: {} }

  constructor() {
    this.loadDB()
  }

  private loadDB(): void {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    }
    if (fs.existsSync(DB_PATH)) {
      try {
        this.db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
      } catch {
        this.db = { ipAssets: {}, licenses: {} }
      }
    }
  }

  private saveDB(): void {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2))
  }

  async registerIPAsset(params: {
    title: string
    description: string
    creatorWallet: string
    mimeType: string
    originalName: string
    totalSize: number
    licenseType: LicenseType
    priceUSD: number
    locationMapCid: string
    isTeamIP?: boolean
    teamSettings?: TeamSettings
  }): Promise<{ ipId: string; txHash: string }> {
    const ipId = `0x${uuidv4().replace(/-/g, '').slice(0, 40)}`
    const txHash = `0x${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`
    const id = uuidv4()

    const asset: IPAsset = {
      id,
      ipId,
      txHash,
      title: params.title,
      description: params.description,
      creatorWallet: params.creatorWallet,
      mimeType: params.mimeType,
      originalName: params.originalName,
      totalSize: params.totalSize,
      licenseType: params.licenseType,
      priceUSD: params.priceUSD,
      locationMapCid: params.locationMapCid,
      registeredAt: new Date().toISOString(),
      downloadCount: 0,
      royaltiesEarned: 0,
      isTeamIP: params.isTeamIP,
      teamSettings: params.teamSettings,
    }

    this.db.ipAssets[id] = asset
    this.saveDB()

    logger.info(`[Mock Story] Registered IP asset: ${ipId} — "${params.title}"`)
    return { ipId, txHash }
  }

  async verifyLicense(ipAssetId: string, walletAddress: string): Promise<boolean> {
    const licenses = Object.values(this.db.licenses)
    const valid = licenses.find(
      (l) =>
        l.ipAssetId === ipAssetId &&
        l.buyerWallet.toLowerCase() === walletAddress.toLowerCase() &&
        (l.expiresAt === null || new Date(l.expiresAt) > new Date())
    )

    logger.debug(`[Mock Story] License check: ${walletAddress} → ${ipAssetId}: ${valid ? 'VALID' : 'NONE'}`)
    return !!valid
  }

  async purchaseLicense(ipAssetId: string, buyerWallet: string): Promise<{ txHash: string; licenseId: string }> {
    const asset = this.getAssetById(ipAssetId)
    if (!asset) throw new Error(`IP asset not found: ${ipAssetId}`)

    // Check for existing valid license
    const alreadyLicensed = await this.verifyLicense(ipAssetId, buyerWallet)
    if (alreadyLicensed) throw new Error('Wallet already holds a valid license for this asset')

    // Prevent creator from licensing their own asset
    if (asset.creatorWallet.toLowerCase() === buyerWallet.toLowerCase()) {
      throw new Error('Creator cannot purchase a license for their own asset')
    }

    const licenseId = uuidv4()
    const txHash = `0x${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`

    const license: License = {
      id: licenseId,
      ipAssetId,
      buyerWallet,
      purchasedAt: new Date().toISOString(),
      expiresAt: null, // permanent license for mock
      txHash,
      pricePaid: asset.priceUSD,
    }

    this.db.licenses[licenseId] = license

    // Update asset stats
    this.db.ipAssets[asset.id].downloadCount += 0 // incremented on actual download
    this.db.ipAssets[asset.id].royaltiesEarned += asset.priceUSD

    this.saveDB()
    logger.info(`[Mock Story] License issued: ${licenseId} → ${buyerWallet} for ${ipAssetId}`)
    return { txHash, licenseId }
  }

  // ── Additional mock helpers ──────────────────────────────────────

  getAllAssets(): IPAsset[] {
    return Object.values(this.db.ipAssets).sort(
      (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    )
  }

  getAssetById(id: string): IPAsset | undefined {
    // Support both internal ID and ipId
    return (
      this.db.ipAssets[id] ??
      Object.values(this.db.ipAssets).find((a) => a.ipId === id)
    )
  }

  getAssetsByCreator(wallet: string): IPAsset[] {
    return Object.values(this.db.ipAssets).filter(
      (a) => a.creatorWallet.toLowerCase() === wallet.toLowerCase()
    )
  }

  getLicensesByBuyer(wallet: string): Array<License & { asset: IPAsset | undefined }> {
    return Object.values(this.db.licenses)
      .filter((l) => l.buyerWallet.toLowerCase() === wallet.toLowerCase())
      .map((l) => ({ ...l, asset: this.getAssetById(l.ipAssetId) }))
  }

  incrementDownload(assetId: string): void {
    if (this.db.ipAssets[assetId]) {
      this.db.ipAssets[assetId].downloadCount++
      this.saveDB()
    }
  }
}

export const mockStoryService = new MockStoryService()
