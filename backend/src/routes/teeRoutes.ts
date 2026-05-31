import { Router, Request, Response } from 'express'
import { teeService } from '../services/teeService'

const router = Router()

router.get('/attest', async (_req: Request, res: Response): Promise<void> => {
  try {
    const att = await teeService.getAttestation()
    res.json({ ok: true, data: att })
  } catch { res.status(503).json({ ok: false, error: 'TEE attestation not ready', code: 'TEE_NOT_READY' }) }
})

router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const att = await teeService.getAttestation()
    res.json({ ok: true, data: { status: 'ONLINE', teeAddress: att.teeAddress, teeVersion: att.teeVersion, startedAt: att.startedAt } })
  } catch { res.status(503).json({ ok: false, error: 'TEE not ready', code: 'TEE_NOT_READY' }) }
})

router.get('/receipts/:receiptId', (req: Request, res: Response): void => {
  const receipt = teeService.getReceipt(req.params.receiptId)
  if (!receipt) { res.status(404).json({ ok: false, error: 'Receipt not found', code: 'RECEIPT_NOT_FOUND' }); return }
  res.json({ ok: true, data: receipt })
})

router.post('/verify', (req: Request, res: Response): void => {
  const { token } = req.body as { token?: string }
  if (!token) { res.status(400).json({ ok: false, error: 'token is required', code: 'MISSING_TOKEN' }); return }
  const decoded = teeService.verifyDownloadToken(token)
  if (!decoded) { res.status(401).json({ ok: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' }); return }
  res.json({ ok: true, data: { valid: true, ...decoded } })
})

export default router
