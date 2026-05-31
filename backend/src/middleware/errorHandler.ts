import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ ok: false, error: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' })
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ ok: false, error: err.message, code: err.code })
    return
  }

  // Multer file size error
  if (err.message.includes('File too large')) {
    res.status(413).json({ ok: false, error: 'File exceeds maximum allowed size', code: 'FILE_TOO_LARGE' })
    return
  }

  // Never leak internal error details in production
  logger.error('Unhandled error:', err)
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  })
}
