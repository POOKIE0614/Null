export type LicenseType = 'commercial' | 'non-commercial' | 'exclusive'

export interface IPAsset {
  id: string; ipId: string; title: string; description: string
  creatorWallet: string; mimeType: string; originalName: string
  totalSize: number; licenseType: LicenseType; priceUSD: number
  registeredAt: string; locationMapCid: string; txHash: string
  downloadCount: number; royaltiesEarned: number
}

export interface UploadJob {
  jobId: string; status: 'processing'|'distributing'|'registering'|'complete'|'failed'
  progress: number; message: string; ipAsset?: IPAsset; error?: string; startedAt: string
}

export interface ReconstructJob {
  jobId: string; status: 'verifying'|'fetching'|'assembling'|'complete'|'failed'
  progress: number; message: string; downloadUrl?: string; error?: string
}

export interface License {
  id: string; ipAssetId: string; buyerWallet: string
  purchasedAt: string; expiresAt: string|null; txHash: string; pricePaid: number
  asset?: IPAsset
}

export interface Wallet {
  address: string; label: string; role: 'creator'|'buyer'; balance: number
}

export interface ApiSuccess<T> { ok: true; data: T }
export interface ApiError { ok: false; error: string; code?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
