import sss from 'shamirs-secret-sharing'
import { sha256 } from '../utils/crypto'
import { Fragment } from '../types'
import { logger } from '../utils/logger'

export interface ShamirResult {
  chunks: ShamirChunkResult[]
  totalFragments: number
}

export interface ShamirChunkResult {
  chunkIndex: number
  originalSize: number
  fragments: Fragment[]
}

/**
 * Splits an array of Buffer chunks into Shamir shares.
 * Each chunk is split independently into N shares (fragments).
 * Any K shares can reconstruct the original chunk — K-1 gives zero information.
 *
 * @param chunks   — array of Buffer slices from the original file
 * @param n        — total shares to create per chunk
 * @param k        — minimum shares needed to reconstruct (threshold)
 */
export function splitChunks(chunks: Buffer[], n: number, k: number): ShamirResult {
  if (k >= n) throw new Error('Threshold k must be less than total shares n')
  if (k < 2) throw new Error('Threshold k must be at least 2')
  if (n > 255) throw new Error('Total shares n cannot exceed 255 (Shamir field limit)')

  logger.debug(`Shamir split: ${chunks.length} chunks → ${n} shares each (threshold: ${k})`)

  const chunkResults: ShamirChunkResult[] = []
  let totalFragments = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    // shamir split — returns array of Buffers
    const shares: Buffer[] = sss.split(chunk, { shares: n, threshold: k })

    const fragments: Fragment[] = shares.map((shareBuffer, idx) => ({
      chunkIndex: i,
      fragmentIndex: idx + 1, // 1-indexed
      x: idx + 1,             // Shamir x-coordinate matches index
      data: shareBuffer.toString('base64'),
      integrityHash: sha256(shareBuffer),
      size: shareBuffer.length,
    }))

    chunkResults.push({
      chunkIndex: i,
      originalSize: chunk.length,
      fragments,
    })

    totalFragments += fragments.length
  }

  logger.debug(`Shamir split complete: ${totalFragments} total fragments`)
  return { chunks: chunkResults, totalFragments }
}

/**
 * Reconstructs a single chunk from at least K fragments.
 * Verifies integrity hash of each fragment before use.
 * Throws if fragments are corrupted or insufficient.
 */
export function reconstructChunk(fragments: Fragment[], k: number): Buffer {
  if (fragments.length < k) {
    throw new Error(`Insufficient fragments: need ${k}, got ${fragments.length}`)
  }

  // Verify integrity of each fragment before using it
  const validFragments: Buffer[] = []

  for (const fragment of fragments) {
    const shareBuffer = Buffer.from(fragment.data, 'base64')
    const computedHash = sha256(shareBuffer)

    if (computedHash !== fragment.integrityHash) {
      logger.warn(`Fragment integrity check failed: chunk ${fragment.chunkIndex}, fragment ${fragment.fragmentIndex}`)
      continue // skip corrupted fragment
    }

    validFragments.push(shareBuffer)
  }

  if (validFragments.length < k) {
    throw new Error(
      `Too many corrupted fragments: need ${k} valid, only ${validFragments.length} passed integrity check`
    )
  }

  // Use exactly K valid fragments for reconstruction
  const reconstructed = sss.combine(validFragments.slice(0, k))
  return reconstructed
}

/**
 * Reconstructs a full file from all chunk fragment sets.
 * Verifies final file hash against original.
 */
export function reconstructFile(
  chunkFragmentSets: Array<{ chunkIndex: number; fragments: Fragment[] }>,
  k: number,
  expectedFileHash: string
): Buffer {
  // Sort by chunk index to ensure correct order
  const sorted = [...chunkFragmentSets].sort((a, b) => a.chunkIndex - b.chunkIndex)

  logger.debug(`Reconstructing ${sorted.length} chunks with threshold k=${k}`)

  const reconstructedChunks: Buffer[] = sorted.map(({ chunkIndex, fragments }) => {
    try {
      return reconstructChunk(fragments, k)
    } catch (err) {
      throw new Error(`Reconstruction failed at chunk ${chunkIndex}: ${(err as Error).message}`)
    }
  })

  const assembled = Buffer.concat(reconstructedChunks)

  // Critical: verify reconstructed file matches original fingerprint
  const assembledHash = sha256(assembled)
  if (assembledHash !== expectedFileHash) {
    throw new Error('File integrity verification FAILED — reconstructed file does not match original hash')
  }

  logger.debug(`File reconstructed successfully: ${assembled.length} bytes, hash verified ✓`)
  return assembled
}
