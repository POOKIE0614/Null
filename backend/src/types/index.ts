// ── Core domain types ──────────────────────────────────────────────

export interface Fragment {
  chunkIndex: number
  fragmentIndex: number // 1..N
  x: number            // Shamir x-coordinate
  data: string         // base64-encoded Shamir share bytes
  integrityHash: string // SHA-256 of raw share bytes
  size: number
}

export interface StoredFragment {
  storageId: string    // mock UUID or real Arweave TxId
  nodeIndex: number    // 1..N
  chunkIndex: number
  integrityHash: string
  backupIds: string[]
}

export interface ChunkMap {
  index: number
  originalSize: number
  fragments: StoredFragment[]
}

export interface LocationMap {
  version: string
  ipAssetId: string
  fileHash: string       // SHA-256 of original file
  originalName: string
  mimeType: string
  totalSize: number
  totalChunks: number
  chunkSizeBytes: number
  n: number              // total fragments per chunk
  k: number              // threshold
  formatMeta: Record<string, unknown>
  createdAt: string
  chunks: ChunkMap[]
}

// ── IP Asset types ──────────────────────────────────────────────────

export type LicenseType = 'commercial' | 'non-commercial' | 'exclusive'

export interface TeamSettings {
  coSigners: string[]
  threshold: number
}

export interface IPAsset {
  id: string
  ipId: string           // Story Protocol IP ID (mock UUID)
  title: string
  description: string
  creatorWallet: string
  mimeType: string
  originalName: string
  totalSize: number
  licenseType: LicenseType
  priceUSD: number
  registeredAt: string
  locationMapCid: string // mock CID for the encrypted location map
  txHash: string         // registration tx hash
  downloadCount: number
  royaltiesEarned: number
  isTeamIP?: boolean
  teamSettings?: TeamSettings
}

// ── License types ───────────────────────────────────────────────────

export interface License {
  id: string
  ipAssetId: string
  buyerWallet: string
  purchasedAt: string
  expiresAt: string | null
  txHash: string
  pricePaid: number
}

// ── Service interfaces — implement these for real providers ─────────

export interface IStorageService {
  storeFragment(fragment: Fragment, nodeIndex: number): Promise<string>
  fetchFragment(storageId: string): Promise<Buffer>
  storeLocationMap(map: LocationMap): Promise<string>
  fetchLocationMap(cid: string): Promise<LocationMap>
}

export interface IStoryService {
  registerIPAsset(params: {
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
  }): Promise<{ ipId: string; txHash: string }>
  verifyLicense(ipAssetId: string, walletAddress: string): Promise<boolean>
  purchaseLicense(ipAssetId: string, buyerWallet: string): Promise<{ txHash: string; licenseId: string }>
}

// ── API response types ──────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ── Upload pipeline ─────────────────────────────────────────────────

export interface UploadJob {
  jobId: string
  status: 'processing' | 'distributing' | 'registering' | 'complete' | 'failed'
  progress: number        // 0-100
  message: string
  ipAsset?: IPAsset
  error?: string
  startedAt: string
}

// ── Reconstruction pipeline ─────────────────────────────────────────

export interface ReconstructJob {
  jobId: string
  status: 'verifying' | 'fetching' | 'assembling' | 'complete' | 'failed'
  progress: number
  message: string
  downloadUrl?: string
  error?: string
}

// ── Wallet simulation (mock) ────────────────────────────────────────

export interface Wallet {
  address: string
  label: string
  role: 'creator' | 'buyer'
  balance: number
}
