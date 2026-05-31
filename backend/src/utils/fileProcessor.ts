import { sha256, detectMimeType, chunkSizeForMime } from './crypto'
import { CONFIG } from '../config/constants'

export interface ProcessedFile {
  originalName: string
  mimeType: string
  detectedMime: string
  totalSize: number
  fileHash: string
  chunks: Buffer[]
  chunkSizeBytes: number
  formatMeta: Record<string, unknown>
}

/**
 * Validates file safety — checks magic bytes, size, etc.
 * Throws on invalid file.
 */
export function validateFile(buffer: Buffer, originalName: string, declaredMime: string): void {
  if (buffer.length === 0) throw new Error('File is empty')
  if (buffer.length > CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`)
  }

  const detected = detectMimeType(buffer)

  // Block executable files regardless of declared MIME
  const blockedMimes = ['application/x-executable', 'application/x-msdos-program']
  const blockedExtensions = ['.exe', '.bat', '.sh', '.cmd', '.com', '.scr', '.vbs']
  const ext = originalName.toLowerCase().slice(originalName.lastIndexOf('.'))

  if (blockedMimes.includes(detected) || blockedExtensions.includes(ext)) {
    throw new Error('Executable files are not permitted')
  }
}

/**
 * Processes a file buffer into chunks ready for Shamir fragmentation.
 * Extracts format metadata for reconstruction.
 */
export function processFile(buffer: Buffer, originalName: string, declaredMime: string): ProcessedFile {
  validateFile(buffer, originalName, declaredMime)

  const detectedMime = detectMimeType(buffer)
  const mimeType = detectedMime !== 'application/octet-stream' ? detectedMime : declaredMime
  const fileHash = sha256(buffer)
  const chunkSizeBytes = chunkSizeForMime(mimeType, CONFIG.CHUNK_SIZE_BYTES)

  // Chunk the byte stream
  const chunks: Buffer[] = []
  let offset = 0
  while (offset < buffer.length) {
    chunks.push(buffer.subarray(offset, offset + chunkSizeBytes))
    offset += chunkSizeBytes
  }

  // Extract lightweight format metadata for reconstruction context
  const formatMeta = extractFormatMeta(buffer, mimeType)

  return {
    originalName,
    mimeType,
    detectedMime,
    totalSize: buffer.length,
    fileHash,
    chunks,
    chunkSizeBytes,
    formatMeta,
  }
}

/** Reconstruct original buffer from ordered chunks */
export function assembleChunks(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks)
}

/** Extract minimal format metadata without decoding full file */
function extractFormatMeta(buffer: Buffer, mime: string): Record<string, unknown> {
  try {
    if (mime === 'audio/wav') {
      // WAV header is 44 bytes
      if (buffer.length >= 44) {
        const sampleRate = buffer.readUInt32LE(24)
        const bitDepth = buffer.readUInt16LE(34)
        const channels = buffer.readUInt16LE(22)
        return { sampleRate, bitDepth, channels }
      }
    }
    if (mime.startsWith('image/')) {
      // PNG: width at offset 16, height at offset 20
      if (mime === 'image/png' && buffer.length >= 24) {
        return {
          width: buffer.readUInt32BE(16),
          height: buffer.readUInt32BE(20),
        }
      }
    }
  } catch {
    // Non-critical — metadata extraction failing is fine
  }
  return {}
}
