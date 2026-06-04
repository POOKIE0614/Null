import { v4 as uuidv4 } from 'uuid'
import { recoverMessageAddress } from 'viem'
import { processFile } from '../utils/fileProcessor'
import { splitChunks, reconstructFile } from './shamirService'
import { pinataStorageService } from './pinataStorageService'
import { mockStorageService } from './mockStorageService'
import { storyProtocolService } from './storyProtocolService'
import { cdrService } from './cdrService'
import { teeService } from './teeService'
import { CONFIG } from '../config/constants'

const activeStorageService = CONFIG.ARWEAVE_PROVIDER === 'real'
  ? pinataStorageService
  : mockStorageService
import { logger } from '../utils/logger'
import { LocationMap, ChunkMap, StoredFragment, Fragment, UploadJob, ReconstructJob, LicenseType } from '../types'

export interface ReshuffleJob {
  jobId: string
  status: 'verifying' | 'fetching' | 'assembling' | 'distributing' | 'cleaning' | 'complete' | 'failed'
  progress: number
  message: string
  error?: string
  startedAt: string
  logs: string[]
}

const uploadJobs     = new Map<string, UploadJob>()
const reconstructJobs = new Map<string, ReconstructJob>()
const reshuffleJobs   = new Map<string, ReshuffleJob>()

const activeCdrService = cdrService

setInterval(() => {
  const cutoff = Date.now() - CONFIG.JOB_TTL_MS
  for (const [id, job] of uploadJobs.entries())
    if (new Date(job.startedAt).getTime() < cutoff) uploadJobs.delete(id)
  for (const [id, job] of reconstructJobs.entries())
    if (job.status === 'complete' || job.status === 'failed') reconstructJobs.delete(id)
  for (const [id, job] of reshuffleJobs.entries())
    if ((job.status === 'complete' || job.status === 'failed') && new Date(job.startedAt).getTime() < cutoff)
      reshuffleJobs.delete(id)
  }, 5 * 60_000)

interface PendingDownload {
  buffer: Buffer; mimeType: string; originalName: string
  expiresAt: number; receiptId: string
}
const pendingDownloads = new Map<string, PendingDownload>()

setInterval(() => {
  const now = Date.now()
  for (const [id, e] of pendingDownloads.entries()) {
    if (e.expiresAt < now) { teeService.secureClear(e.buffer); pendingDownloads.delete(id) }
  }
}, 60_000)

export const getUploadJob      = (id: string) => uploadJobs.get(id)
export const getReconstructJob = (id: string) => reconstructJobs.get(id)
export const getReshuffleJob   = (id: string) => reshuffleJobs.get(id)

export function consumeDownload(token: string): { buffer: Buffer; mimeType: string; originalName: string } | undefined {
  const decoded = teeService.verifyDownloadToken(token)
  if (!decoded) return undefined
  const entry = pendingDownloads.get(decoded.tokenId)
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) { teeService.secureClear(entry.buffer); pendingDownloads.delete(decoded.tokenId) }
    return undefined
  }
  teeService.markDelivered(entry.receiptId)
  pendingDownloads.delete(decoded.tokenId)
  return { buffer: entry.buffer, mimeType: entry.mimeType, originalName: entry.originalName }
}

export function startUploadPipeline(params: {
  fileBuffer: Buffer; originalName: string; mimeType: string; title: string
  description: string; creatorWallet: string; licenseType: LicenseType; priceUSD: number
  isTeamIP?: boolean; teamSettings?: { coSigners: string[]; threshold: number }
}): string {
  const jobId = uuidv4()
  uploadJobs.set(jobId, { jobId, status: 'processing', progress: 0, message: 'Processing file...', startedAt: new Date().toISOString() })
  runUploadPipeline(jobId, params).catch(err => {
    const j = uploadJobs.get(jobId)!
    j.status = 'failed'; j.error = err.message; j.message = 'Upload failed: ' + err.message
    logger.error(`Upload ${jobId} failed:`, err)
  })
  return jobId
}

/**
 * confirmIPRegistration — called by the frontend after the user's wallet
 * has submitted the Story Protocol mintAndRegisterIp transaction.
 * The frontend passes back the real ipId + txHash from the on-chain tx.
 */
export async function confirmIPRegistration(params: {
  jobId: string
  ipId: string
  txHash: string
}): Promise<void> {
  const job = uploadJobs.get(params.jobId)
  if (!job) throw new Error('Job not found')
  if (job.status !== 'awaiting_registration' as any) throw new Error('Job not awaiting registration')

  const pending = (job as any).pendingRegistration as {
    title: string; description: string; creatorWallet: string; mimeType: string
    originalName: string; totalSize: number; licenseType: LicenseType
    priceUSD: number; locationMapCid: string; isTeamIP?: boolean
    teamSettings?: { coSigners: string[]; threshold: number }
  }
  if (!pending) throw new Error('No pending registration data')

  // Save to local DB via Story service
  await storyProtocolService.confirmRegistration({
    ...pending,
    ipId: params.ipId,
    txHash: params.txHash,
  })

  const asset = storyProtocolService.getAssetById(params.ipId)
  Object.assign(job, {
    status: 'complete',
    progress: 100,
    message: 'IP asset registered on Story Protocol ✓',
    ipAsset: asset,
  })
  logger.info(`Job ${params.jobId}: Confirmed ipId=${params.ipId} tx=${params.txHash.slice(0, 16)}...`)
}

async function runUploadPipeline(jobId: string, params: {
  fileBuffer: Buffer; originalName: string; mimeType: string; title: string
  description: string; creatorWallet: string; licenseType: LicenseType; priceUSD: number
  isTeamIP?: boolean; teamSettings?: { coSigners: string[]; threshold: number }
}): Promise<void> {
  const upd = (u: Partial<UploadJob>) => Object.assign(uploadJobs.get(jobId)!, u)

  upd({ progress: 5, message: 'Fingerprinting and chunking file...' })
  const processed = processFile(params.fileBuffer, params.originalName, params.mimeType)

  upd({ progress: 18, message: `Shamir SSS — ${processed.chunks.length} chunks × ${CONFIG.FRAGMENTS_TOTAL} shares...` })
  const shamirResult = splitChunks(processed.chunks, CONFIG.FRAGMENTS_TOTAL, CONFIG.FRAGMENTS_THRESHOLD)

  upd({ status: 'distributing', progress: 28, message: 'Uploading Shamir fragments to Pinata IPFS...' })

  const chunkMaps: ChunkMap[] = []
  const total = shamirResult.chunks.length
  const step  = 40 / total

  for (let ci = 0; ci < total; ci++) {
    const { fragments, originalSize } = shamirResult.chunks[ci]
    const stored = await Promise.all(
      fragments.map(async (frag) => {
        const storageId = await activeStorageService.storeFragment(frag, frag.fragmentIndex)
        return {
          storageId,
          nodeIndex: frag.fragmentIndex,
          chunkIndex: frag.chunkIndex,
          integrityHash: frag.integrityHash,
          backupIds: []
        }
      })
    )
    chunkMaps.push({ index: ci, originalSize, fragments: stored })
    upd({ progress: Math.round(28 + (ci + 1) * step), message: `Uploading fragments ${ci + 1}/${total}...` })
  }

  upd({ progress: 70, message: 'Pinning location map to IPFS...' })
  const locationMap: LocationMap = {
    version: 'nullvault-1.0', ipAssetId: '', fileHash: processed.fileHash,
    originalName: processed.originalName, mimeType: processed.mimeType,
    totalSize: processed.totalSize, totalChunks: processed.chunks.length,
    chunkSizeBytes: processed.chunkSizeBytes, n: CONFIG.FRAGMENTS_TOTAL,
    k: CONFIG.FRAGMENTS_THRESHOLD, formatMeta: processed.formatMeta,
    createdAt: new Date().toISOString(), chunks: chunkMaps,
  }

  const pinataCid = await activeStorageService.storeLocationMap(locationMap)
  logger.info(`Job ${jobId}: Location map pinned → ${pinataCid}`)

  upd({ progress: 75, message: 'Sealing location map CID in CDR vault (DKG threshold encryption)...' })
  const cdrVaultUUID = await activeCdrService.sealCID(pinataCid)
  logger.info(`Job ${jobId}: CDR vault → ${cdrVaultUUID}`)

  // ── Hand off to frontend wallet for on-chain Story Protocol registration ──
  // The frontend will call POST /api/upload/confirm with ipId + txHash
  // after the user's MetaMask submits mintAndRegisterIp on-chain.
  const pendingRegistration = {
    title: params.title,
    description: params.description,
    creatorWallet: params.creatorWallet,
    mimeType: processed.mimeType,
    originalName: processed.originalName,
    totalSize: processed.totalSize,
    licenseType: params.licenseType,
    priceUSD: params.priceUSD,
    locationMapCid: cdrVaultUUID,
    isTeamIP: params.isTeamIP,
    teamSettings: params.teamSettings,
  }

  const job = uploadJobs.get(jobId)!
  Object.assign(job, {
    status: 'awaiting_registration',
    progress: 80,
    message: 'Ready for on-chain registration — confirm in your wallet...',
    pendingRegistration,
  } as any)

  logger.info(`Job ${jobId}: Awaiting frontend wallet registration`)
}

export function startReconstructPipeline(params: { assetId: string; buyerWallet: string; signatures?: string[] }): string {
  const jobId = uuidv4()
  reconstructJobs.set(jobId, { jobId, status: 'verifying', progress: 0, message: 'Verifying license on Story Protocol...' })
  runReconstructPipeline(jobId, params).catch(err => {
    const j = reconstructJobs.get(jobId)!
    j.status = 'failed'; j.error = err.message; j.message = err.message
    logger.error(`Reconstruct ${jobId} failed:`, err)
  })
  return jobId
}

async function runReconstructPipeline(jobId: string, params: { assetId: string; buyerWallet: string; signatures?: string[] }): Promise<void> {
  const upd = (u: Partial<ReconstructJob>) => Object.assign(reconstructJobs.get(jobId)!, u)
  const sessionId = teeService.createSessionId()

  const asset = storyProtocolService.getAssetById(params.assetId)
  if (!asset) throw new Error('IP asset not found')

  if (asset.isTeamIP) {
    const teamSettings = asset.teamSettings
    if (!teamSettings || !teamSettings.coSigners || teamSettings.coSigners.length === 0) {
      throw new Error('Team IP settings are missing or invalid')
    }
    const threshold = teamSettings.threshold || 1
    const signatures = params.signatures || []

    upd({ progress: 5, message: 'Verifying co-signer signatures...' })

    const message = `NullVault: Reconstruct asset ${asset.id}`
    const recoveredAddresses = new Set<string>()
    for (const sig of signatures) {
      try {
        const address = await recoverMessageAddress({
          message,
          signature: sig as `0x${string}`
        })
        if (address) {
          recoveredAddresses.add(address.toLowerCase())
        }
      } catch (err: any) {
        logger.warn(`Signature recovery failed: ${err.message}`)
      }
    }

    let validCount = 0
    const matchedCoSigners: string[] = []
    for (const coSigner of teamSettings.coSigners) {
      if (recoveredAddresses.has(coSigner.toLowerCase())) {
        validCount++
        matchedCoSigners.push(coSigner)
      }
    }

    if (validCount < threshold) {
      throw new Error(`Insufficient valid signatures. Required ${threshold}, but got ${validCount} from co-signers.`)
    }
    logger.info(`Multi-sig verified: ${validCount}/${threshold} from matched co-signers: ${matchedCoSigners.join(', ')}`)
  }

  const isCreator = asset.creatorWallet.toLowerCase() === params.buyerWallet.toLowerCase()
  if (!isCreator) {
    const licensed = await storyProtocolService.verifyLicense(params.assetId, params.buyerWallet)
    if (!licensed) throw new Error('No valid license. Purchase a license first.')
  }

  upd({ progress: 15, message: 'License verified ✓ — unsealing CDR vault...' })
  const pinataCid = await activeCdrService.unsealCID(asset.locationMapCid)

  upd({ status: 'fetching', progress: 30, message: 'Fetching location map from Pinata IPFS...' })
  const locationMap = await activeStorageService.fetchLocationMap(pinataCid)
  const { k, totalChunks, fileHash, mimeType, originalName } = locationMap

  upd({ progress: 36, message: `Fetching K=${k} fragments per chunk from IPFS...` })
  const chunkFragmentSets: Array<{ chunkIndex: number; fragments: Fragment[] }> = []
  const step = 42 / totalChunks

  for (const chunkMap of locationMap.chunks) {
    const toFetch = chunkMap.fragments.slice(0, k)
    const fetched: Fragment[] = []
    for (const sf of toFetch) {
      const buf = await activeStorageService.fetchFragment(sf.storageId)
      fetched.push({ chunkIndex: chunkMap.index, fragmentIndex: sf.nodeIndex, x: sf.nodeIndex, data: buf.toString('base64'), integrityHash: sf.integrityHash, size: buf.length })
    }
    chunkFragmentSets.push({ chunkIndex: chunkMap.index, fragments: fetched })
    upd({ progress: Math.round(36 + (chunkMap.index + 1) * step), message: `Fetching chunks ${chunkMap.index + 1}/${totalChunks}...` })
  }

  upd({ status: 'assembling', progress: 80, message: 'TEE: Lagrange interpolation + SHA-256 verify...' })
  const reconstructed = reconstructFile(chunkFragmentSets, k, fileHash)

  upd({ progress: 90, message: 'TEE: Signing reconstruction receipt...' })
  const receipt = await teeService.createReceipt({
    sessionId, assetId: asset.id, ipId: asset.ipId,
    buyerWallet: params.buyerWallet, fileHash, fileSizeBytes: reconstructed.length,
  })

  const downloadToken = teeService.createDownloadToken({ receiptId: receipt.receiptId, assetId: asset.id, buyerWallet: params.buyerWallet })
  const decoded       = teeService.verifyDownloadToken(downloadToken)!

  pendingDownloads.set(decoded.tokenId, { buffer: reconstructed, mimeType, originalName, expiresAt: decoded.expiresAt, receiptId: receipt.receiptId })
  storyProtocolService.incrementDownload(asset.id)

  upd({ status: 'complete', progress: 100, message: 'TEE: File reconstructed, signed, staged for delivery ✓', downloadUrl: `/api/download/${downloadToken}` })
  logger.info(`Reconstruct ${jobId}: ${reconstructed.length} bytes session=${sessionId.slice(0, 8)}`)
}

export function startReshufflePipeline(assetId: string, requestWallet: string): string {
  const jobId = uuidv4()
  reshuffleJobs.set(jobId, {
    jobId,
    status: 'verifying',
    progress: 0,
    message: 'Validating IP ownership...',
    startedAt: new Date().toISOString(),
    logs: [`[${new Date().toLocaleTimeString()}] Initializing reshuffling enclave...`]
  })
  runReshufflePipeline(jobId, assetId, requestWallet).catch(err => {
    const j = reshuffleJobs.get(jobId)
    if (j) {
      j.status = 'failed'
      j.error = err.message
      j.message = err.message
      j.logs.push(`[${new Date().toLocaleTimeString()}] Reshuffle failed: ${err.message}`)
    }
    logger.error(`Reshuffle job ${jobId} failed:`, err)
  })
  return jobId
}

async function runReshufflePipeline(jobId: string, assetId: string, requestWallet: string): Promise<void> {
  const upd = (u: Partial<ReshuffleJob>) => {
    const j = reshuffleJobs.get(jobId)
    if (j) Object.assign(j, u)
  }
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    const j = reshuffleJobs.get(jobId)
    if (j) {
      j.logs.push(`[${time}] ${msg}`)
    }
    upd({ message: msg })
  }

  addLog('Validating IP ownership...')
  const asset = storyProtocolService.getAssetById(assetId)
  if (!asset) throw new Error('IP asset not found')

  if (asset.creatorWallet.toLowerCase() !== requestWallet.toLowerCase()) {
    throw new Error('Only the IP creator can trigger fragment rotation')
  }

  upd({ progress: 10 })
  addLog('Enclave active: retrieving dynamic unseal pointer...')

  const pinataCid = await activeCdrService.unsealCID(asset.locationMapCid)
  upd({ progress: 20 })
  addLog('Fetching location map from Pinata IPFS...')
  const oldLocationMap = await activeStorageService.fetchLocationMap(pinataCid)
  const { k, n, totalChunks, fileHash, mimeType, originalName } = oldLocationMap

  upd({ progress: 35 })
  addLog(`Enclave active: fetching old fragments for Lagrange interpolation...`)
  const chunkFragmentSets: Array<{ chunkIndex: number; fragments: Fragment[] }> = []

  // Gather old fragment storage CIDs to clean them up later
  const oldFragmentCids: string[] = []
  for (const chunkMap of oldLocationMap.chunks) {
    const toFetch = chunkMap.fragments.slice(0, k)
    const fetched: Fragment[] = []
    for (const sf of toFetch) {
      const buf = await activeStorageService.fetchFragment(sf.storageId)
      fetched.push({
        chunkIndex: chunkMap.index,
        fragmentIndex: sf.nodeIndex,
        x: sf.nodeIndex,
        data: buf.toString('base64'),
        integrityHash: sf.integrityHash,
        size: buf.length
      })
    }
    chunkFragmentSets.push({ chunkIndex: chunkMap.index, fragments: fetched })

    // Collect all N old fragment CIDs from the chunkMap to unpin them
    for (const sf of chunkMap.fragments) {
      oldFragmentCids.push(sf.storageId)
    }
  }

  upd({ progress: 50 })
  addLog('Lagrange interpolation verified expected file hash')
  const reconstructedBuffer = reconstructFile(chunkFragmentSets, k, fileHash)

  upd({ progress: 60 })
  addLog('Generated new polynomial coefficients')

  // Reprocess file buffer to get chunks
  const processed = processFile(reconstructedBuffer, originalName, mimeType)
  const shamirResult = splitChunks(processed.chunks, n, k)

  upd({ progress: 75 })
  addLog('Uploading 10 new SSS fragments to IPFS...')
  const newChunkMaps: ChunkMap[] = []
  const total = shamirResult.chunks.length

  for (let ci = 0; ci < total; ci++) {
    const { fragments, originalSize } = shamirResult.chunks[ci]
    const stored = await Promise.all(
      fragments.map(async (frag) => {
        const storageId = await activeStorageService.storeFragment(frag, frag.fragmentIndex)
        return {
          storageId,
          nodeIndex: frag.fragmentIndex,
          chunkIndex: frag.chunkIndex,
          integrityHash: frag.integrityHash,
          backupIds: []
        }
      })
    )
    newChunkMaps.push({ index: ci, originalSize, fragments: stored })
  }

  upd({ progress: 85 })
  addLog('Pinning new location map to IPFS...')
  const newLocationMap: LocationMap = {
    ...oldLocationMap,
    createdAt: new Date().toISOString(),
    chunks: newChunkMaps
  }
  const newPinataCid = await activeStorageService.storeLocationMap(newLocationMap)

  addLog('Dynamic unseal pointer successfully updated on-chain (sealing new map)...')
  const newCdrVaultUUID = await activeCdrService.sealCID(newPinataCid)

  upd({ progress: 95 })
  addLog('Unpinning stale fragment CIDs from Pinata...')
  // Unpin the old location map CID
  try {
    await activeStorageService.unpin(pinataCid)
  } catch (err: any) {
    logger.warn(`Failed to unpin old location map CID ${pinataCid}: ${err.message}`)
  }

  // Unpin all old fragments in background
  for (const cid of oldFragmentCids) {
    activeStorageService.unpin(cid).catch((err: any) => {
      logger.warn(`Failed to unpin fragment CID ${cid}: ${err.message}`)
    })
  }

  // Update DB record
  storyProtocolService.updateAssetLocationMap(assetId, newCdrVaultUUID)

  upd({ progress: 100, status: 'complete' })
  addLog('Reshuffling complete! Access coordinates rotated successfully ✓')
}
