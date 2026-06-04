import 'dotenv/config'
import express from 'express'
import { CONFIG } from './config/constants'
import { securityHeaders, corsMiddleware, generalRateLimit, requestLogger, stripResponseHeaders } from './middleware/security'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import uploadRoutes from './routes/uploadRoutes'
import accessRoutes from './routes/accessRoutes'
import teeRoutes    from './routes/teeRoutes'
import { teeService } from './services/teeService'

const app = express()

app.set('trust proxy', 1)
app.use(stripResponseHeaders)
app.use(securityHeaders)
app.use(corsMiddleware)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(generalRateLimit)
app.use(requestLogger)

app.get('/api/health', async (_req, res) => {
  let teeAddress = 'initialising...'
  try { const att = await teeService.getAttestation(); teeAddress = att.teeAddress } catch { /* still starting */ }
  res.json({
    ok: true, data: {
      service: 'NullVault API', version: '2.0.0',
      network: 'Story Aeneid Testnet', storage: 'Pinata IPFS',
      shamir: `N=${CONFIG.FRAGMENTS_TOTAL}, K=${CONFIG.FRAGMENTS_THRESHOLD}`,
      tee: { address: teeAddress, attestation: '/api/tee/attest' },
      timestamp: new Date().toISOString(),
    },
  })
})

app.use('/api/upload',   uploadRoutes)
app.use('/api/access',   accessRoutes)
app.use('/api/download', accessRoutes)
app.use('/api/tee',      teeRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

const server = app.listen(CONFIG.PORT, async () => {
  logger.info(`🚀  NullVault API at http://localhost:${CONFIG.PORT}`)
  logger.info(`📦  Storage Provider: ${CONFIG.ARWEAVE_PROVIDER}`)
  logger.info(`🔗  Story Provider  : ${CONFIG.STORY_PROVIDER}`)
  logger.info(`🔐  Shamir  : N=${CONFIG.FRAGMENTS_TOTAL}, K=${CONFIG.FRAGMENTS_THRESHOLD}`)
  try {
    const att = await teeService.getAttestation()
    logger.info(`🛡️   TEE     : ${att.teeAddress}`)
  } catch { /* logged internally */ }
})

process.on('SIGTERM', () => { server.close(() => { logger.info('Server closed'); process.exit(0) }) })
process.on('SIGINT',  () => { server.close(() => process.exit(0)) })

export default app
