import { Router, Request, Response } from 'express'
import { requireWallet } from '../middleware/security'
import { storyProtocolService } from '../services/storyProtocolService'
import { teeService } from '../services/teeService'
import { startReconstructPipeline, getReconstructJob, consumeDownload } from '../services/vaultService'
import { logger } from '../utils/logger'

const router = Router()

router.post('/license/:assetId', requireWallet, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.headers['x-wallet-address'] as string
  const asset  = storyProtocolService.getAssetById(req.params.assetId)
  if (!asset) { res.status(404).json({ ok: false, error: 'IP asset not found', code: 'ASSET_NOT_FOUND' }); return }
  if (asset.creatorWallet.toLowerCase() === wallet.toLowerCase()) { res.status(400).json({ ok: false, error: 'Cannot license own asset', code: 'OWN_ASSET' }); return }
  if (await storyProtocolService.verifyLicense(req.params.assetId, wallet)) { res.status(409).json({ ok: false, error: 'Already licensed', code: 'ALREADY_LICENSED' }); return }
  try {
    const result = await storyProtocolService.purchaseLicense(req.params.assetId, wallet)
    res.json({ ok: true, data: { ...result, assetId: req.params.assetId, buyerWallet: wallet } })
  } catch (err) { res.status(400).json({ ok: false, error: (err as Error).message, code: 'LICENSE_FAILED' }) }
})

router.get('/license/:assetId/check', requireWallet, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.headers['x-wallet-address'] as string
  const asset  = storyProtocolService.getAssetById(req.params.assetId)
  if (!asset) { res.status(404).json({ ok: false, error: 'Asset not found', code: 'ASSET_NOT_FOUND' }); return }
  const isCreator  = asset.creatorWallet.toLowerCase() === wallet.toLowerCase()
  const hasLicense = isCreator || await storyProtocolService.verifyLicense(req.params.assetId, wallet)
  res.json({ ok: true, data: { hasLicense, isCreator, assetId: req.params.assetId, wallet } })
})

router.get('/licenses', requireWallet, (req: Request, res: Response): void => {
  res.json({ ok: true, data: storyProtocolService.getLicensesByBuyer(req.headers['x-wallet-address'] as string) })
})

router.post('/reconstruct/:assetId', requireWallet, (req: Request, res: Response): void => {
  const { signatures } = req.body
  const jobId = startReconstructPipeline({
    assetId: req.params.assetId,
    buyerWallet: req.headers['x-wallet-address'] as string,
    signatures
  })
  res.status(202).json({ ok: true, data: { jobId, message: 'TEE reconstruction started' } })
})

router.get('/reconstruct/job/:jobId', (req: Request, res: Response): void => {
  const job = getReconstructJob(req.params.jobId)
  if (!job) { res.status(404).json({ ok: false, error: 'Job not found', code: 'JOB_NOT_FOUND' }); return }
  res.json({ ok: true, data: job })
})

router.get('/download/:token', (req: Request, res: Response): void => {
  const entry = consumeDownload(req.params.token)
  if (!entry) { res.status(404).json({ ok: false, error: 'Download link expired. Reconstruct again.', code: 'DOWNLOAD_EXPIRED' }); return }
  logger.info(`[TEE] Serving: "${entry.originalName}" (${entry.buffer.length} bytes)`)
  res.setHeader('Content-Type', entry.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(entry.originalName)}"`)
  res.setHeader('Content-Length', entry.buffer.length)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('X-TEE-Address', teeService.address)
  const buf = entry.buffer
  res.on('finish', () => { teeService.secureClear(buf) })
  res.send(entry.buffer)
})

export default router
