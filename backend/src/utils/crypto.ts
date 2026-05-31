import crypto from 'crypto'

/** SHA-256 hash of a buffer — returns hex string */
export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/** SHA-256 hash of a string */
export function sha256String(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex')
}

/** Generate a cryptographically random hex string of given byte length */
export function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/** Detect MIME type from magic bytes — never trust file extension */
export function detectMimeType(buffer: Buffer): string {
  const hex = buffer.subarray(0, 12).toString('hex')

  // PNG
  if (hex.startsWith('89504e47')) return 'image/png'
  // JPEG
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  // GIF
  if (hex.startsWith('474946')) return 'image/gif'
  // WebP
  if (hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  // PDF
  if (hex.startsWith('25504446')) return 'application/pdf'
  // ZIP (includes DOCX, XLSX, etc.)
  if (hex.startsWith('504b0304')) return 'application/zip'
  // MP4 / MOV
  if (buffer.length > 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4'
  // WebM
  if (hex.startsWith('1a45dfa3')) return 'video/webm'
  // MP3 (ID3)
  if (hex.startsWith('494433')) return 'audio/mpeg'
  // MP3 (no ID3)
  if (hex.startsWith('fffb') || hex.startsWith('fff3')) return 'audio/mpeg'
  // WAV
  if (hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  // FLAC
  if (hex.startsWith('664c6143')) return 'audio/flac'

  return 'application/octet-stream'
}

/** Get chunk size recommendation per mime type */
export function chunkSizeForMime(mime: string, defaultSize: number): number {
  if (mime.startsWith('video/')) return 2 * 1024 * 1024    // 2MB for video
  if (mime.startsWith('audio/')) return 512 * 1024          // 512KB for audio
  if (mime.startsWith('image/')) return 256 * 1024          // 256KB for images
  return defaultSize                                          // default for text/docs
}

/** Simple constant-time buffer comparison to prevent timing attacks */
export function safeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
