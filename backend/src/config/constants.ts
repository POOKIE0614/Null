import 'dotenv/config'

export const CONFIG = {
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_MB ?? '100', 10) * 1024 * 1024,
  FRAGMENTS_TOTAL: parseInt(process.env.FRAGMENTS_TOTAL ?? '10', 10),
  FRAGMENTS_THRESHOLD: parseInt(process.env.FRAGMENTS_THRESHOLD ?? '6', 10),
  CHUNK_SIZE_BYTES: parseInt(process.env.CHUNK_SIZE_KB ?? '64', 10) * 1024,
  DATA_DIR: process.env.DATA_DIR ?? './src/data',
  STORY_PROVIDER: process.env.STORY_PROVIDER ?? 'mock',
  ARWEAVE_PROVIDER: process.env.ARWEAVE_PROVIDER ?? 'mock',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100,
  UPLOAD_RATE_LIMIT_MAX: 10,

  // Job expiry
  JOB_TTL_MS: 30 * 60 * 1000, // 30 minutes
} as const

// Validate critical config
if (CONFIG.FRAGMENTS_THRESHOLD >= CONFIG.FRAGMENTS_TOTAL) {
  throw new Error('FRAGMENTS_THRESHOLD must be less than FRAGMENTS_TOTAL')
}
