import fetch from 'node-fetch'
import FormData from 'form-data'
import { Fragment, LocationMap, IStorageService } from '../types'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

const PINATA_JWT     = process.env.PINATA_JWT!
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
const PINATA_API     = 'https://api.pinata.cloud'

if (!PINATA_JWT) throw new Error('PINATA_JWT not set in .env')

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let last: Error | undefined
  for (let i = 0; i < retries; i++) {
    try { return await fn() }
    catch (e) {
      last = e as Error
      if (i < retries - 1) await new Promise(r => setTimeout(r, 600 * Math.pow(2, i)))
    }
  }
  throw last
}

class PinataStorageService implements IStorageService {
  async storeFragment(fragment: Fragment, nodeIndex: number): Promise<string> {
    const data = Buffer.from(fragment.data, 'base64')
    const filename = `nv_c${String(fragment.chunkIndex).padStart(4,'0')}_f${String(fragment.fragmentIndex).padStart(2,'0')}_n${String(nodeIndex).padStart(2,'0')}.bin`

    return withRetry(async () => {
      const form = new FormData()
      form.append('file', data, { filename, contentType: 'application/octet-stream' })
      form.append('pinataMetadata', JSON.stringify({
        name: filename,
        keyvalues: {
          chunkIndex:    String(fragment.chunkIndex),
          fragmentIndex: String(fragment.fragmentIndex),
          nodeIndex:     String(nodeIndex),
          integrityHash: fragment.integrityHash,
          app: 'nullvault',
        },
      }))
      form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

      const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PINATA_JWT}`, ...form.getHeaders() },
        body: form,
      })

      if (!res.ok) throw new Error(`Pinata upload failed (${res.status}): ${await res.text()}`)
      const json = await res.json() as { IpfsHash: string }
      logger.info(`[Pinata] Fragment stored c${fragment.chunkIndex}/f${fragment.fragmentIndex} → ${json.IpfsHash}`)
      return json.IpfsHash
    })
  }

  async fetchFragment(storageId: string): Promise<Buffer> {
    return withRetry(async () => {
      const res = await fetch(`${PINATA_GATEWAY}/ipfs/${storageId}`, {
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
      })
      if (!res.ok) throw new Error(`Pinata fetch failed (${res.status}) CID: ${storageId}`)
      const buf = await res.buffer()
      logger.debug(`[Pinata] Fragment fetched ${storageId} (${buf.length} bytes)`)
      return buf
    })
  }

  async storeLocationMap(locationMap: LocationMap): Promise<string> {
    return withRetry(async () => {
      const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PINATA_JWT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinataContent: locationMap,
          pinataMetadata: {
            name: `NullVault-Map-${locationMap.fileHash.slice(0, 12)}`,
            keyvalues: { ipAssetId: locationMap.ipAssetId || 'pending', app: 'nullvault' },
          },
          pinataOptions: { cidVersion: 1 },
        }),
      })
      if (!res.ok) throw new Error(`Pinata JSON pin failed (${res.status}): ${await res.text()}`)
      const json = await res.json() as { IpfsHash: string }
      logger.info(`[Pinata] Location map stored → ${json.IpfsHash}`)
      return json.IpfsHash
    })
  }

  async fetchLocationMap(cid: string): Promise<LocationMap> {
    return withRetry(async () => {
      const res = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`, {
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
      })
      if (!res.ok) throw new Error(`Pinata fetch map failed (${res.status}) CID: ${cid}`)
      const map = await res.json() as LocationMap
      logger.debug(`[Pinata] Location map fetched ${cid}`)
      return map
    })
  }
}

export const pinataStorageService = new PinataStorageService()
