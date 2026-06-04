import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

/** Strict security headers via Helmet */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow downloads
})

/** CORS — dynamically allow local dev, Vercel subdomains, and the configured frontend URL */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // If no origin (e.g. server-to-server, curl, same-origin without Origin header), allow it
    if (!origin) {
      callback(null, true)
      return
    }

    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)
    const isVercel = origin.endsWith('.vercel.app')
    const isConfigured = origin === CONFIG.FRONTEND_URL

    if (isLocalhost || isVercel || isConfigured) {
      callback(null, true)
    } else {
      logger.warn(`[CORS] Rejected origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Wallet-Address'],
  credentials: false,
  maxAge: 86400,
})

/** General rate limiter */
export const generalRateLimit = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max: CONFIG.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests — please slow down', code: 'RATE_LIMITED' },
  skip: (req) => CONFIG.NODE_ENV === 'test',
})

/** Strict rate limiter for upload endpoint */
export const uploadRateLimit = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max: CONFIG.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Upload limit reached — maximum 10 uploads per 15 minutes', code: 'UPLOAD_RATE_LIMITED' },
})

/** Request logger middleware */
export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  const redactedUrl = req.url.replace(/wallet=[^&]+/, 'wallet=[REDACTED]')
  logger.debug(`${req.method} ${redactedUrl} — ${req.ip}`)
  next()
}

/** Strip sensitive headers from response */
export const stripResponseHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.removeHeader('X-Powered-By')
  res.removeHeader('Server')
  next()
}

/** Wallet address validation middleware — checks X-Wallet-Address header */
export function requireWallet(req: Request, res: Response, next: NextFunction): void {
  const wallet = req.headers['x-wallet-address'] as string | undefined

  if (!wallet) {
    res.status(401).json({ ok: false, error: 'Wallet address required', code: 'NO_WALLET' })
    return
  }

  // Basic format check — 42 char hex starting with 0x
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ ok: false, error: 'Invalid wallet address format', code: 'INVALID_WALLET' })
    return
  }

  next()
}
