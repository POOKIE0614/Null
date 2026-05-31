import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Fragment, LocationMap, IStorageService } from '../types'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const FRAGMENTS_DIR = path.resolve(CONFIG.DATA_DIR, 'fragments')
const MAPS_DIR = path.resolve(CONFIG.DATA_DIR, 'maps')

// Ensure storage directories exist
function ensureDirs(): void {
  ;[FRAGMENTS_DIR, MAPS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })
}

ensureDirs()

/**
 * MOCK Arweave storage.
 * Stores fragments and location maps as local files.
 * Replace this class with a real IrysStorageService when ready.
 *
 * SWAP INSTRUCTION:
 * 1. Create `src/services/irysStorageService.ts` implementing IStorageService
 * 2. Change import in vaultService.ts from mockStorageService to irysStorageService
 * 3. Set ARWEAVE_PROVIDER=real in .env
 */
export class MockStorageService implements IStorageService {
  private readonly provider = 'mock-arweave'

  async storeFragment(fragment: Fragment, nodeIndex: number): Promise<string> {
    ensureDirs()
    const storageId = `mock_${uuidv4().replace(/-/g, '')}`
    const filePath = path.join(FRAGMENTS_DIR, `${storageId}.bin`)

    // Store: nodeIndex + chunkIndex header (8 bytes) + fragment data
    const header = Buffer.alloc(8)
    header.writeUInt32BE(nodeIndex, 0)
    header.writeUInt32BE(fragment.chunkIndex, 4)
    const dataBuffer = Buffer.from(fragment.data, 'base64')
    const envelope = Buffer.concat([header, dataBuffer])

    fs.writeFileSync(filePath, envelope)

    // Store integrity metadata separately
    const metaPath = path.join(FRAGMENTS_DIR, `${storageId}.meta.json`)
    fs.writeFileSync(metaPath, JSON.stringify({
      storageId,
      nodeIndex,
      chunkIndex: fragment.chunkIndex,
      fragmentIndex: fragment.fragmentIndex,
      integrityHash: fragment.integrityHash,
      size: fragment.size,
      storedAt: new Date().toISOString(),
      provider: this.provider,
    }))

    logger.debug(`[Mock Arweave] Stored fragment chunk=${fragment.chunkIndex} node=${nodeIndex} → ${storageId}`)
    return storageId
  }

  async fetchFragment(storageId: string): Promise<Buffer> {
    const filePath = path.join(FRAGMENTS_DIR, `${storageId}.bin`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Fragment not found: ${storageId}`)
    }

    const envelope = fs.readFileSync(filePath)
    // Skip the 8-byte header to get raw fragment data
    const fragmentData = envelope.subarray(8)

    logger.debug(`[Mock Arweave] Fetched fragment ${storageId} (${fragmentData.length} bytes)`)
    return fragmentData
  }

  async storeLocationMap(locationMap: LocationMap): Promise<string> {
    ensureDirs()
    const cid = `mock_map_${uuidv4().replace(/-/g, '')}`
    const filePath = path.join(MAPS_DIR, `${cid}.json`)

    fs.writeFileSync(filePath, JSON.stringify(locationMap, null, 2))
    logger.debug(`[Mock Arweave] Stored location map → ${cid}`)
    return cid
  }

  async fetchLocationMap(cid: string): Promise<LocationMap> {
    const filePath = path.join(MAPS_DIR, `${cid}.json`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Location map not found: ${cid}`)
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as LocationMap
  }

  /** Dev helper: list all stored fragment IDs */
  listFragments(): string[] {
    return fs
      .readdirSync(FRAGMENTS_DIR)
      .filter((f) => f.endsWith('.bin'))
      .map((f) => f.replace('.bin', ''))
  }
}

export const mockStorageService = new MockStorageService()
