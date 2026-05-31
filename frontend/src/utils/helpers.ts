export const fmt = {
  bytes: (b: number): string => {
    if (b < 1024) return `${b} B`
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
    return `${(b / 1024 ** 3).toFixed(2)} GB`
  },
  addr: (addr: string): string => `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  hash: (h: string): string => `${h.slice(0, 10)}...${h.slice(-6)}`,
  date: (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  usd: (n: number): string => `$${n.toFixed(2)}`,
  mime: (mime: string): string => {
    const map: Record<string, string> = {
      'image/png': 'PNG Image', 'image/jpeg': 'JPEG Image', 'image/gif': 'GIF',
      'image/webp': 'WebP', 'audio/wav': 'WAV Audio', 'audio/mpeg': 'MP3 Audio',
      'audio/flac': 'FLAC Audio', 'video/mp4': 'MP4 Video', 'video/webm': 'WebM Video',
      'application/pdf': 'PDF Document', 'application/zip': 'ZIP Archive',
      'text/plain': 'Text File', 'application/octet-stream': 'Binary File',
    }
    return map[mime] ?? mime
  },
  mimeIcon: (mime: string): string => {
    if (mime.startsWith('image/')) return '🖼'
    if (mime.startsWith('audio/')) return '🎵'
    if (mime.startsWith('video/')) return '🎬'
    if (mime === 'application/pdf') return '📄'
    if (mime.includes('zip') || mime.includes('tar')) return '📦'
    if (mime.startsWith('text/')) return '📝'
    return '🔐'
  },
}

export function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function truncateMiddle(str: string, maxLen = 24): string {
  if (str.length <= maxLen) return str
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half)}...${str.slice(-half)}`
}
