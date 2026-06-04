import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { body, validationResult } from 'express-validator'
import { requireWallet, uploadRateLimit } from '../middleware/security'
import { startUploadPipeline, getUploadJob, confirmIPRegistration, startReshufflePipeline, getReshuffleJob } from '../services/vaultService'
import { storyProtocolService } from '../services/storyProtocolService'
import { CONFIG } from '../config/constants'
import { LicenseType } from '../types'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const blocked = ['.exe', '.bat', '.sh', '.cmd', '.scr', '.vbs', '.msi']
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
    if (blocked.includes(ext)) return cb(new Error('Executable files are not permitted'))
    cb(null, true)
  },
})

const uploadValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1–200 characters'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description must be 1–2000 characters'),
  body('licenseType').isIn(['commercial', 'non-commercial', 'exclusive']).withMessage('Invalid license type'),
  body('priceUSD').isFloat({ min: 0, max: 100000 }).withMessage('Price must be 0–100,000'),
]

router.post('/', uploadRateLimit, requireWallet, upload.single('file'), uploadValidation,
  (req: Request, res: Response, _next: NextFunction): void => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ ok: false, error: errors.array()[0].msg, code: 'VALIDATION_ERROR' }); return }
    if (!req.file) { res.status(400).json({ ok: false, error: 'No file provided', code: 'NO_FILE' }); return }

    let isTeamIP = req.body.isTeamIP === 'true' || req.body.isTeamIP === true
    let teamSettings = undefined
    if (isTeamIP) {
      let coSigners: string[] = []
      if (req.body.coSigners) {
        if (typeof req.body.coSigners === 'string') {
          try {
            // Try parsing as JSON array first
            const parsed = JSON.parse(req.body.coSigners)
            if (Array.isArray(parsed)) {
              coSigners = parsed.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean)
            } else {
              coSigners = String(req.body.coSigners).split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
            }
          } catch {
            coSigners = String(req.body.coSigners).split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          }
        } else if (Array.isArray(req.body.coSigners)) {
          coSigners = req.body.coSigners.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean)
        }
      }
      const threshold = parseInt(req.body.threshold ?? '1', 10)
      teamSettings = { coSigners, threshold }
    }

    const jobId = startUploadPipeline({
      fileBuffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype,
      title: req.body.title.trim(), description: req.body.description.trim(),
      creatorWallet: req.headers['x-wallet-address'] as string,
      licenseType: req.body.licenseType as LicenseType, priceUSD: parseFloat(req.body.priceUSD),
      isTeamIP,
      teamSettings,
    })
    res.status(202).json({ ok: true, data: { jobId, message: 'Upload pipeline started' } })
  }
)

router.get('/job/:jobId', (req: Request, res: Response): void => {
  const job = getUploadJob(req.params.jobId)
  if (!job) { res.status(404).json({ ok: false, error: 'Job not found or expired', code: 'JOB_NOT_FOUND' }); return }
  res.json({ ok: true, data: job })
})

router.get('/assets', (_req: Request, res: Response): void => {
  res.json({ ok: true, data: storyProtocolService.getAllAssets() })
})

router.get('/assets/creator', requireWallet, (req: Request, res: Response): void => {
  res.json({ ok: true, data: storyProtocolService.getAssetsByCreator(req.headers['x-wallet-address'] as string) })
})

router.get('/assets/:id', (req: Request, res: Response): void => {
  const asset = storyProtocolService.getAssetById(req.params.id)
  if (!asset) { res.status(404).json({ ok: false, error: 'Asset not found', code: 'ASSET_NOT_FOUND' }); return }
  res.json({ ok: true, data: asset })
})

router.post('/confirm', requireWallet, async (req: Request, res: Response): Promise<void> => {
  const { jobId, ipId, txHash } = req.body
  if (!jobId || !ipId || !txHash) {
    res.status(400).json({ ok: false, error: 'Missing jobId, ipId, or txHash' })
    return
  }
  try {
    await confirmIPRegistration({ jobId, ipId, txHash })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/assets/:id/reshuffle', requireWallet, (req: Request, res: Response): void => {
  const wallet = req.headers['x-wallet-address'] as string
  try {
    const jobId = startReshufflePipeline(req.params.id, wallet)
    res.status(202).json({ ok: true, data: { jobId, message: 'Reshuffling pipeline started' } })
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

router.get('/assets/reshuffle/job/:jobId', (req: Request, res: Response): void => {
  const job = getReshuffleJob(req.params.jobId)
  if (!job) { res.status(404).json({ ok: false, error: 'Reshuffle job not found or expired', code: 'JOB_NOT_FOUND' }); return }
  res.json({ ok: true, data: job })
})

export default router
