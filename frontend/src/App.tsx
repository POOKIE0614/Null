import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, useDisconnect, useConnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import Lenis from 'lenis'

/* ═══════════════════════════════════════════════════════════════════════
   §1  FONT & KEYFRAME REGISTRATION (BLOKYZ DESIGN SYSTEM)
   ═══════════════════════════════════════════════════════════════════════ */
function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById('nv-redesign-styles')) return
    const s = document.createElement('style')
    s.id = 'nv-redesign-styles'
    s.textContent = `
      /* Blokyz Display Fonts */
      .font-display {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .font-display-italic {
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 700;
        font-style: italic;
        letter-spacing: -0.01em;
        text-transform: uppercase;
      }
      .font-tech {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .font-body {
        font-family: 'DM Sans', sans-serif;
        font-weight: 400;
      }
      .font-body-light {
        font-family: 'DM Sans', sans-serif;
        font-weight: 300;
      }

      /* Subtle entry animations */
      @keyframes page-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes spin-clean {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes soft-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.55; }
      }

      .anim-page { animation: page-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) both; }
      .anim-spin { animation: spin-clean 1s linear infinite; }
      .anim-pulse { animation: soft-pulse 2s ease-in-out infinite; }

      /* Blokyz Shadows & Cards */
      .product-shadow {
        box-shadow: rgba(0, 0, 0, 0.4) 0px 10px 40px 0px;
      }
      
      /* Solid Dark Blocks (replacing Frosted Glass) */
      .frosted-glass {
        background: #060606 !important;
        border-bottom: 1px solid #111111;
      }
      .frosted-glass-dark {
        background: #111111 !important;
        border: 1px solid #333333;
      }

      /* Hover & Press Micro-interactions */
      .btn-press:active {
        transform: scale(0.98);
      }
      .btn-press {
        transition: all 0.2s ease-out;
      }
      
      /* Void Logo Interactive Styling */
      .void-logo-hover {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
      }
      .void-logo-hover:hover {
        transform: rotate(45deg) scale(1.1);
      }
    `
    document.head.appendChild(s)
  }, [])
}

/* ═══════════════════════════════════════════════════════════════════════
   §2  LENIS SMOOTH KINETICS
   ═══════════════════════════════════════════════════════════════════════ */
function useLenisScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])
}

/* ═══════════════════════════════════════════════════════════════════════
   §3  SCROLL-LINKED RATIO HOOK
   ═══════════════════════════════════════════════════════════════════════ */
function useScrollRatio() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  return scrollY
}

/* ═══════════════════════════════════════════════════════════════════════
   §4  DESIGN SYSTEM CONTEXT (APPLE BRAND TOKENS)
   ═══════════════════════════════════════════════════════════════════════ */
const ACCENT = '#fdfdfd' // Action Blue
const ACCENT_DEEP = '#0071e3' // Focus Blue
const ACCENT_GLOW = 'rgba(0, 102, 204, 0.15)'
const BG_DARK = '#fdfdfd' // Ink / Dark Tile
const BG_CARD = '#1a1a1a' // Pure White Canvas
const BG_SURFACE = '#111111' // Parchment Off-White
const BORDER = '1px solid #222222' // Hairline
const BORDER_ACCENT = '1px solid #fdfdfd'
const TEXT = {
  primary: '#fdfdfd', // Near-Black
  secondary: '#333333', // Muted Ink
  muted: '#7a7a7a', // Slate Muted
  dim: '#71717a', // Light Muted
  dark: '#fdfdfd',
}

/* ═══════════════════════════════════════════════════════════════════════
   §5  BUSINESS LOGIC API CLIENT
   ═══════════════════════════════════════════════════════════════════════ */
const API = '/api'
async function apiFetch(method: string, path: string, opts: { walletAddress?: string; body?: unknown; isForm?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = {}
  if (opts.walletAddress) headers['x-wallet-address'] = opts.walletAddress
  if (!opts.isForm && opts.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    cache: 'no-store',
    body: opts.isForm ? (opts.body as FormData) : opts.body ? JSON.stringify(opts.body) : undefined
  })
  let json: { ok: boolean; data: unknown; error?: string }
  try {
    json = await res.json() as typeof json
  } catch {
    throw new Error(`Server connection lost (HTTP ${res.status}).`)
  }
  if (!json.ok) throw new Error(json.error || `Action failed: ${path}`)
  return json.data
}

function pollJob(
  fetchFn: () => Promise<{ status: string; progress: number; [k: string]: unknown }>,
  onUpdate: (j: { status: string; progress: number; [k: string]: unknown }) => void,
  ms = 850,
  resolveOnStatuses: string[] = ['complete']
): Promise<{ status: string; progress: number; [k: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try {
        const j = await fetchFn()
        onUpdate(j)
        if (resolveOnStatuses.includes(j.status)) {
          clearInterval(id)
          resolve(j)
        }
        if (j.status === 'failed') {
          clearInterval(id)
          reject(new Error((j as Record<string, string>).error || 'Job failed'))
        }
      } catch (e) {
        clearInterval(id)
        reject(e)
      }
    }, ms)
  })
}

const nvApi = {
  health: () => apiFetch('GET', '/health'),
  getAllAssets: () => apiFetch('GET', '/upload/assets'),
  getMyAssets: (w: string) => apiFetch('GET', '/upload/assets/creator', { walletAddress: w }),
  pollUpload: (id: string) => apiFetch('GET', `/upload/job/${id}`),
  uploadFile: (fd: FormData, w: string) => apiFetch('POST', '/upload', { walletAddress: w, body: fd, isForm: true }),
  confirmRegistration: (jobId: string, ipId: string, txHash: string, w: string) =>
    apiFetch('POST', '/upload/confirm', { walletAddress: w, body: { jobId, ipId, txHash } }),
  getMyLicenses: (w: string) => apiFetch('GET', '/access/licenses', { walletAddress: w }),
  checkLicense: (aid: string, w: string) => apiFetch('GET', `/access/license/${aid}/check`, { walletAddress: w }),
  purchaseLicense: (aid: string, w: string) => apiFetch('POST', `/access/license/${aid}`, { walletAddress: w }),
  startReconstruct: (aid: string, w: string, signatures?: string[]) => apiFetch('POST', `/access/reconstruct/${aid}`, { walletAddress: w, body: { signatures } }),
  pollReconstruct: (id: string) => apiFetch('GET', `/access/reconstruct/job/${id}`),
  reshuffleAsset: (aid: string, w: string) => apiFetch('POST', `/upload/assets/${aid}/reshuffle`, { walletAddress: w }),
  pollReshuffle: (jobId: string) => apiFetch('GET', `/upload/assets/reshuffle/job/${jobId}`),
}

/* ═══════════════════════════════════════════════════════════════════════
   §6  HIGH-PERFORMANCE SYSTEM NOTIFICATIONS (TOASTS)
   ═══════════════════════════════════════════════════════════════════════ */
let _triggerToast = (_: { msg: string; type: string }) => {}
const toast = {
  success: (msg: string) => _triggerToast({ msg, type: 'success' }),
  error: (msg: string) => _triggerToast({ msg, type: 'error' }),
  info: (msg: string) => _triggerToast({ msg, type: 'info' }),
}

interface ToastItem { id: number; msg: string; type: string; exit: boolean }
function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    _triggerToast = ({ msg, type }) => {
      const id = Date.now() + Math.random()
      setToasts(p => [...p, { id, msg, type, exit: false }])
      setTimeout(() => {
        setToasts(p => p.map(t => (t.id === id ? { ...t, exit: true } : t)))
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 400)
      }, 3500)
    }
  }, [])

  const colorMap: Record<string, string> = { success: '#10b981', error: '#f43f5e', info: '#a1a1aa' }
  const iconMap: Record<string, string> = { success: '✓', error: '✕', info: '◆' }

  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', maxWidth: 360 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          background: 'rgba(9,9,11,0.96)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${colorMap[t.type]}40`,
          pointerEvents: 'all',
          boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
          animation: t.exit ? 'nv-to 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'nv-ti 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          <span style={{ color: colorMap[t.type], fontFamily: 'monospace', fontWeight: 'bold' }}>{iconMap[t.type]}</span>
          <span style={{ fontSize: 13, color: '#fafafa', lineHeight: 1.4, fontFamily: 'sans-serif' }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  CORE PRIMITIVES & FORMATTERS
   ═══════════════════════════════════════════════════════════════════════ */
type TeamSettings = { coSigners: string[]; threshold: number }
type Asset = {
  id: string
  ipId: string
  title: string
  description: string
  creatorWallet: string
  mimeType: string
  originalName: string
  totalSize: number
  licenseType: string
  priceUSD: number
  registeredAt: string
  locationMapCid: string
  txHash: string
  downloadCount: number
  royaltiesEarned: number
  isTeamIP?: boolean
  teamSettings?: TeamSettings
  lastReshuffledAt?: string
}
type License = {
  id: string
  ipAssetId: string
  buyerWallet: string
  purchasedAt: string
  expiresAt: string | null
  txHash: string
  pricePaid: number
  asset?: Asset
}

const fmt = {
  bytes: (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b >= 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B',
  usd: (v: number) => v === 0 ? 'Free License' : '$' + v.toLocaleString(),
  addr: (a: string) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '—',
  hash: (h: string) => h ? h.slice(0, 12) + '…' + h.slice(-6) : '—',
  date: (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  icon: (t: string) => t.startsWith('image/') ? '🖼' : t.startsWith('audio/') ? '🎵' : t.startsWith('video/') ? '🎬' : t.includes('pdf') ? '📄' : t.includes('text') || t.includes('javascript') ? '💾' : '📦',
}

/* ═══════════════════════════════════════════════════════════════════════
   §8  ATMOSPHERIC VERTICAL GRID & PARTICLES
   ═══════════════════════════════════════════════════════════════════════ */
function ParticleField() {
  return null;
}

function InfinityLine() {
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   §9  VOID DISSOLVE — DATA FRAGMENTATION VISUALIZER
   ═══════════════════════════════════════════════════════════════════════ */

function ShardSphere3D({ progress, phase }: { progress: number; phase: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const timeRef = useRef(0)
  const particlesRef = useRef<Array<{
    baseX: number; baseY: number;
    x: number; y: number;
    vx: number; vy: number;
    size: number; rotation: number;
    rotSpeed: number; delay: number;
    opacity: number; dissolved: boolean;
  }>>([])

  // Initialize particles as a structured grid
  useEffect(() => {
    const particles: typeof particlesRef.current = []
    const gridSize = 4
    const cellSize = 28
    const offsetX = 140 - (gridSize * cellSize) / 2
    const offsetY = 140 - (gridSize * cellSize) / 2

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        // Skip some cells to create an interesting shape (cross/diamond pattern)
        const dist = Math.abs(row - 1.5) + Math.abs(col - 1.5)
        if (dist > 3) continue

        const bx = offsetX + col * cellSize + cellSize / 2
        const by = offsetY + row * cellSize + cellSize / 2
        const angle = Math.atan2(by - 140, bx - 140)
        const speed = 0.3 + Math.random() * 0.6

        particles.push({
          baseX: bx, baseY: by,
          x: bx, y: by,
          vx: Math.cos(angle + (Math.random() - 0.5) * 1.2) * speed,
          vy: Math.sin(angle + (Math.random() - 0.5) * 1.2) * speed,
          size: 8 + Math.random() * 6,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.04,
          delay: dist * 0.12 + Math.random() * 0.1,
          opacity: 1,
          dissolved: false,
        })
      }
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = 280 * dpr
    canvas.height = 280 * dpr
    ctx.scale(dpr, dpr)

    const isIdle = phase === 'idle'
    const isComplete = phase === 'complete'
    const isFailed = phase === 'failed'
    const dissolveAmount = isIdle ? 0 : Math.min(1, progress / 100)

    const animate = () => {
      timeRef.current += 0.016
      const t = timeRef.current
      ctx.clearRect(0, 0, 280, 280)

      const particles = particlesRef.current
      const accentR = isComplete ? 16 : isFailed ? 239 : 253
      const accentG = isComplete ? 185 : isFailed ? 68 : 253
      const accentB = isComplete ? 129 : isFailed ? 68 : 253

      // Draw subtle grid lines in background
      ctx.strokeStyle = 'rgba(51, 51, 51, 0.4)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 280; i += 28) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 280); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(280, i); ctx.stroke()
      }

      // Center void circle (always present)
      const pulseR = 18 + Math.sin(t * 2) * 3
      const gradient = ctx.createRadialGradient(140, 140, 0, 140, 140, pulseR + 20)
      gradient.addColorStop(0, `rgba(${accentR}, ${accentG}, ${accentB}, 0.08)`)
      gradient.addColorStop(0.5, `rgba(${accentR}, ${accentG}, ${accentB}, 0.03)`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.arc(140, 140, pulseR + 20, 0, Math.PI * 2); ctx.fill()

      // Draw connection lines from center to each particle
      for (const p of particles) {
        const effectiveDissolve = Math.max(0, Math.min(1, (dissolveAmount - p.delay) / (1 - p.delay)))

        if (effectiveDissolve > 0 && effectiveDissolve < 1 && !isIdle) {
          const lx = p.baseX + (p.vx * effectiveDissolve * 180)
          const ly = p.baseY + (p.vy * effectiveDissolve * 180)
          const lineOp = Math.max(0, 0.15 * (1 - effectiveDissolve))
          ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${lineOp})`
          ctx.lineWidth = 0.5
          ctx.setLineDash([2, 4])
          ctx.beginPath(); ctx.moveTo(140, 140); ctx.lineTo(lx, ly); ctx.stroke()
          ctx.setLineDash([])
        }
      }

      // Draw each data fragment
      for (const p of particles) {
        const effectiveDissolve = isIdle ? 0 : isComplete ? 0 : Math.max(0, Math.min(1, (dissolveAmount - p.delay) / (1 - p.delay)))

        let px: number, py: number, opacity: number, rot: number

        if (isIdle || isComplete) {
          // Assembled state: gentle floating
          const floatX = Math.sin(t * 0.8 + p.baseX * 0.1) * 2
          const floatY = Math.cos(t * 0.6 + p.baseY * 0.1) * 2
          px = p.baseX + floatX
          py = p.baseY + floatY
          opacity = isComplete ? 1 : 0.7 + Math.sin(t + p.baseX) * 0.3
          rot = Math.sin(t * 0.3 + p.delay * 10) * 0.1
        } else {
          // Dissolving: fragments scatter outward
          px = p.baseX + p.vx * effectiveDissolve * 180
          py = p.baseY + p.vy * effectiveDissolve * 180
          opacity = Math.max(0, 1 - effectiveDissolve * 1.2)
          rot = p.rotation + effectiveDissolve * p.rotSpeed * 60
        }

        if (opacity <= 0) continue

        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(rot)
        ctx.globalAlpha = opacity

        // Fragment body — sharp rectangles
        const half = p.size / 2
        ctx.fillStyle = isComplete
          ? `rgba(${accentR}, ${accentG}, ${accentB}, 0.15)`
          : 'rgba(253, 253, 253, 0.06)'
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${isIdle ? 0.2 : 0.4 + effectiveDissolve * 0.4})`
        ctx.lineWidth = 1
        ctx.fillRect(-half, -half, p.size, p.size)
        ctx.strokeRect(-half, -half, p.size, p.size)

        // Inner data line pattern
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${0.1 + (isIdle ? 0 : effectiveDissolve * 0.2)})`
        ctx.lineWidth = 0.5
        for (let li = -half + 3; li < half; li += 3) {
          ctx.beginPath()
          ctx.moveTo(-half + 1, li)
          ctx.lineTo(-half + 1 + (p.size - 2) * (0.3 + Math.sin(li + t) * 0.3), li)
          ctx.stroke()
        }

        ctx.restore()
      }

      // Center void symbol (∅)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#060606'
      ctx.beginPath(); ctx.arc(140, 140, 22, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, 0.6)`
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(140, 140, 22, 0, Math.PI * 2); ctx.stroke()

      // Center text
      ctx.fillStyle = `rgb(${accentR}, ${accentG}, ${accentB})`
      ctx.font = '700 10px "Poppins", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = isComplete ? '✓' : isFailed ? '✗' : !isIdle ? `${Math.round(progress)}%` : '∅'
      ctx.fillText(label, 140, 141)

      // Outer ring pulse
      if (!isIdle) {
        const ringOpacity = 0.1 + Math.sin(t * 3) * 0.05
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${ringOpacity})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(140, 140, 60 + Math.sin(t * 1.5) * 5, 0, Math.PI * 2); ctx.stroke()
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [progress, phase])

  return (
    <div style={{ position: 'relative', width: 280, height: 280, margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        style={{ width: 280, height: 280, display: 'block' }}
      />
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════
   §10  3D CARD ROTATION COMPONENT (APPLE CLEAN CHASSIS)
   ═══════════════════════════════════════════════════════════════════════ */
function Card3D({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    ref.current.style.transform = `translateY(-4px)`
    ref.current.style.boxShadow = `0px 10px 30px rgba(0,0,0,0.5)`
    ref.current.style.borderColor = '#fdfdfd'
  }

  const handleMouseLeave = () => {
    if (!ref.current) return
    ref.current.style.transform = 'translateY(0px)'
    ref.current.style.boxShadow = 'none'
    ref.current.style.borderColor = '#333333'
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: '#111111',
        border: '1px solid #333333',
        borderRadius: 2,
        transition: 'all 0.25s ease-out',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §11  FUZZY SYSTEM TERMINAL LOG STREAM
   ═══════════════════════════════════════════════════════════════════════ */
function TerminalLog({ phase }: { phase: string }) {
  const [logs, setLogs] = useState<string[]>([])
  const logQueue = useRef<string[]>([])

  useEffect(() => {
    if (phase === 'idle') {
      setLogs(['SYSTEM IN STATUS: NOMINAL (AENEID TESTNET)'])
      return
    }

    const messages: Record<string, string[]> = {
      processing: [
        'INITIATING SECURE ENCLAVE CONNECTIONS...',
        'TEE PROVISIONED SECURELY ON INTEL SGX.',
        'ACQUIRING CRYPTOGRAPHIC SYSTEM HARNESS...',
        'FINGERPRINTING RAW DATA BUFFER...',
      ],
      fragmenting: [
        'SHREDDING PLAINTEXT BYTES VIA SHAMIR SSS...',
        'SSS SPLITTING GENERATING MATRIX POLYNOMIALS (N=10, K=6)...',
        'COMPUTING HIGH-ORDER COORDINATES FOR PIECES...',
        'CALCULATING SECURE SHA-256 PARITY SUMS...',
      ],
      distributing: [
        'DISPERSING FRAGMENTS ACROSS STORAGE DEPLOYMENTS...',
        'NODE 01..10 IPFS PIN REQUESTS REGISTERED...',
        'TEE DELETING TEMPORARY CACHE IN MEMORY CORE...',
        'FRACTURE DISTRIBUTION MATRIX EXPORTED.',
      ],
      registering: [
        'REQUESTING STORY REGISTER PROTOCOL REGISTRY...',
        'MINTING IP NFT ON SPG CONTRACT CORE...',
        'ATTACHING PIL LICENSE terms (CDR ENCRYPTED)...',
        'Story IP ASSET CREATED SECURELY.',
      ],
      verifying: [
        'VALIDATING LICENSE OWNER PERMISSION METADATA...',
        'TEE CONFIRMING ON-CHAIN VERIFICATION RECORD...',
        'ACQUIRING RECONSTRUCTION LOCKS FROM CDR PIPELINE...',
      ],
      fetching: [
        'RETRIEVING DISTRIBUTED FRAGMENTS FROM INDEPENDENT SERVERS...',
        'ACQUIRED FRAGMENT PIECES N1, N3, N6, N8, N10...',
        'VERIFYING PARITY INTEGRITY MATRIX CHECKSUMS...',
      ],
      assembling: [
        'INTERPOLATING LAGRANGE SHARES IN SECURE MEMORY...',
        'RECONSTRUCTING CRYPTO BLOCK CHUNKS...',
        'PRODUCING RAW DECRYPTED FILE MATRIX...',
      ],
      complete: [
        'CRYPTOGRAPHIC SYNTHESIS VERIFIED ✓',
        'TEARING DOWN ENCLAVE MEMORY SPACE...',
        'SYSTEM READY FOR NEXT INSTRUCTION.',
      ],
    }

    if (messages[phase]) {
      logQueue.current = [...messages[phase]]
      const interval = setInterval(() => {
        if (logQueue.current.length > 0) {
          const next = logQueue.current.shift()!
          setLogs(prev => [...prev.slice(-6), `[${new Date().toLocaleTimeString()}] ${next}`])
        } else {
          clearInterval(interval)
        }
      }, 500)
      return () => clearInterval(interval)
    }
  }, [phase])

  return (
    <div style={{
      background: BG_DARK,
      border: BORDER,
      padding: '12px 18px',
      height: 120,
      overflowY: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginTop: 20,
    }}>
      {logs.map((log, index) => (
        <div key={index} className="font-tech" style={{
          color: log.includes('✓') || log.includes('SUCCESS') ? '#10b981' : log.includes('ERROR') ? '#f43f5e' : TEXT.muted,
          fontSize: 12,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}>
          ➔ {log}
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §12  MODERN BUTTONS WITH CORNER DECORATIONS
   ═══════════════════════════════════════════════════════════════════════ */
function Btn({
  children,
  onClick,
  disabled,
  variant = 'primary',
  full,
  size = 'md',
  style = {},
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  full?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}) {
  const pad = size === 'sm' ? '10px 20px' : size === 'lg' ? '18px 36px' : '14px 28px'
  const fz = size === 'sm' ? 12 : size === 'lg' ? 16 : 14
  const radius = '2px' // Blocky shape

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: pad,
    fontSize: fz,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: radius,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    userSelect: 'none',
    ...(full ? { width: '100%' } : {}),
    ...style,
  }

  const styles = {
    primary: {
      background: '#fdfdfd',
      color: '#060606',
    },
    secondary: {
      background: 'transparent',
      border: '1px solid #333333',
      color: '#fdfdfd',
    },
    danger: {
      background: '#111111',
      color: '#fdfdfd',
      border: '1px solid #333333',
    },
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...styles[variant] }}
      className="btn-press"
    >
      {children}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §13  GLOBAL NAVIGATION (APPLE DUAL NAV)
   ═══════════════════════════════════════════════════════════════════════ */
function WalletButton({ onConnect, onDisconnect }: { onConnect?: (a: string) => void; onDisconnect?: () => void }) {
  const { address, isConnected, isConnecting, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect } = useConnect()
  const { data: balanceData } = useBalance({ address, query: { enabled: !!address } })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    if (isConnected && address) onConnect?.(address)
    else if (!isConnected && !isConnecting) onDisconnect?.()
  }, [isConnected, isConnecting, address])

  const wrongChain = chain && chain.id !== 1513

  const handleConnect = () => {
    connect({ connector: injected() })
  }

  const handleSwitchNetwork = async () => {
    try {
      await (window as any).ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x5E9' }], // 1513 in hex
      })
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await (window as any).ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x5E9',
              chainName: 'Story Aeneid Testnet',
              nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
              rpcUrls: ['https://aeneid.storyrpc.io'],
              blockExplorerUrls: ['https://aeneid.storyscan.io'],
            }],
          })
        } catch {
          toast.error('Failed to add Story network')
        }
      }
    }
  }

  if (isConnecting) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', border: '1px solid #333333', borderRadius: '9999px', background: '#111111' }}>
      <div className="anim-spin" style={{ width: 12, height: 12, border: `2px solid #fdfdfd30`, borderTopColor: '#fdfdfd', borderRadius: '50%' }} />
      <span className="font-tech" style={{ fontSize: 11, color: '#7a7a7a' }}>CONNECTING...</span>
    </div>
  )

  if (!isConnected) return (
    <button
      onClick={handleConnect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: '#fdfdfd',
        borderRadius: '9999px',
        cursor: 'pointer',
        border: 'none',
      }}
      className="btn-press"
    >
      <span className="font-tech" style={{ fontSize: 11, color: '#1a1a1a', fontWeight: 500 }}>CONNECT WALLET</span>
    </button>
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: wrongChain ? '#f43f5e0d' : '#111111',
          border: wrongChain ? '1px solid #f43f5e50' : '1px solid #333333',
          cursor: 'pointer',
          borderRadius: '9999px',
        }}
        className="btn-press"
      >
        <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: wrongChain ? '#f43f5e' : '#10b981' }} />
        <span className="font-tech" style={{ fontSize: 11, color: wrongChain ? '#f43f5e' : '#fdfdfd' }}>{wrongChain ? 'WRONG NETWORK' : fmt.addr(address!)}</span>
        <span style={{ color: '#71717a', fontSize: 10, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && (
        <div className="frosted-glass" style={{
          position: 'absolute',
          right: 0,
          top: 36,
          width: 280,
          border: '1px solid #222222',
          borderRadius: '14px',
          zIndex: 200,
          boxShadow: `rgba(0, 0, 0, 0.08) 0px 8px 24px`,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #222222' }}>
            <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginBottom: 6 }}>CONNECTED ADDRESS</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#fdfdfd', wordBreak: 'break-all', marginBottom: 6 }}>{address}</div>
            <div style={{ fontSize: 11, color: wrongChain ? '#f43f5e' : '#7a7a7a' }}>{chain?.name ?? 'Unknown chain'}</div>
            {balanceData && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#111111', borderRadius: 8, border: '1px solid #222222' }}>
                <span className="font-tech" style={{ fontSize: 9, color: '#71717a' }}>BALANCE&nbsp;&nbsp;</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#fdfdfd', fontWeight: 600 }}>
                  {parseFloat(balanceData.formatted).toFixed(4)} {balanceData.symbol}
                </span>
              </div>
            )}
            {wrongChain && (
              <button
                onClick={handleSwitchNetwork}
                style={{ marginTop: 10, width: '100%', padding: '8px 12px', background: '#f43f5e', border: 'none', fontSize: 12, color: '#1a1a1a', cursor: 'pointer', borderRadius: 8 }}
              >
                SWITCH TO STORY AENEID
              </button>
            )}
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={`https://aeneid.storyscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="font-tech"
              style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid #222222', fontSize: 11, color: '#fdfdfd', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block', borderRadius: 8 }}
            >EXPLORER DETAILS ↗</a>
            <button onClick={() => { disconnect(); setOpen(false); toast.info('Wallet disconnected') }} className="font-tech" style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid #fdfdfd', fontSize: 11, color: '#fdfdfd', cursor: 'pointer', textAlign: 'center', borderRadius: 8 }}>DISCONNECT</button>
          </div>
        </div>
      )}
    </div>
  )
}

function VoidLogo({ size = 18, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }} className="void-logo-hover">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="void-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fdfdfd" />
            <stop offset="100%" stopColor="#3388ff" />
          </linearGradient>
        </defs>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="url(#void-grad)"
          strokeWidth="2.5"
        />
        <line
          x1="6.5"
          y1="17.5"
          x2="17.5"
          y2="6.5"
          stroke="url(#void-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function Nav({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 15)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottom: scrolled ? '1px solid #111111' : '1px solid transparent',
      background: scrolled ? '#060606' : 'transparent',
      transition: 'all 0.3s ease-out',
    }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => { setPage('home'); setMobileMenuOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Poppins', sans-serif", color: '#fdfdfd', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
            <VoidLogo size={20} style={{ marginRight: 8 }} /> <span>NullVault</span>
          </span>
        </button>

        {/* Desktop Menu */}
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <nav style={{ display: 'flex', gap: 24 }}>
            {[
              { id: 'home', label: 'Explore' },
              { id: 'explore', label: 'Catalog' },
              { id: 'vault', label: 'My Vault' }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => setPage(l.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: page === l.id ? '#fdfdfd' : '#71717a',
                  fontWeight: page === l.id ? 700 : 500,
                  transition: 'color 0.2s',
                  padding: '6px 0',
                }}
              >
                {l.label}
              </button>
            ))}
          </nav>
          <div style={{ height: 16, width: 1, background: '#333333' }} />
          <WalletButton onConnect={addr => toast.success(`Wallet: ${fmt.addr(addr)}`)} onDisconnect={() => toast.info('Disconnected')} />
        </div>

        {/* Mobile Toggle & Wallet */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WalletButton onConnect={addr => toast.success(`Wallet: ${fmt.addr(addr)}`)} onDisconnect={() => toast.info('Disconnected')} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 4,
              width: 32,
              height: 32,
            }}
          >
            <span style={{ width: 18, height: 2, background: '#fdfdfd', transform: mobileMenuOpen ? 'rotate(45deg) translate(3px, 5px)' : 'none', transition: 'transform 0.2s' }} />
            <span style={{ width: 18, height: 2, background: '#fdfdfd', opacity: mobileMenuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ width: 18, height: 2, background: '#fdfdfd', transform: mobileMenuOpen ? 'rotate(-45deg) translate(3px, -5px)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-only" style={{
          background: '#060606',
          borderTop: '1px solid #111111',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          borderBottom: '1px solid #111111',
          zIndex: 99,
        }}>
          {[
            { id: 'home', label: 'Explore' },
            { id: 'explore', label: 'Catalog' },
            { id: 'vault', label: 'My Vault' }
          ].map(l => (
            <button
              key={l.id}
              onClick={() => { setPage(l.id); setMobileMenuOpen(false) }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                fontFamily: "'Poppins', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: page === l.id ? '#fdfdfd' : '#71717a',
                fontWeight: page === l.id ? 700 : 500,
                textAlign: 'left',
                padding: '8px 0',
                width: '100%',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §14  TAGLINE BANNER
   ═══════════════════════════════════════════════════════════════════════ */
function StatsTicker({ assets: _ }: { assets: Asset[] }) {
  return (
    <div style={{
      borderBottom: BORDER,
      padding: '16px 24px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1,
      background: '#111111',
    }}>
      <p className="font-body-light tagline-text" style={{ fontSize: 15, color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
        Nothing is stored.{' '}
        <span style={{ color: '#fdfdfd', fontWeight: 600 }}>Everything is preserved.</span>{' '}
        Split into mathematical fragments on IPFS, secured by the Story Protocol CDR.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §15  EXPLORE IP MARKETPLACE & CARD TILT PHYSICS
   ═══════════════════════════════════════════════════════════════════════ */
function AssetCard({ asset, onClick, showCreator = true, licensed = false }: { asset: Asset; onClick: () => void; showCreator?: boolean; licensed?: boolean }) {
  return (
    <Card3D style={{ cursor: 'pointer' }}>
      <div onClick={onClick} style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{
              width: 44,
              height: 44,
              background: '#1a1a1a',
              border: '1px solid #333333',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}>
              {fmt.icon(asset.mimeType)}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fdfdfd', marginBottom: 4 }}>{asset.priceUSD ? `$${asset.priceUSD}` : 'Free'}</div>
              <span className="font-tech" style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: '2px',
                border: licensed ? '1px solid #7D39EC' : '1px solid #fdfdfd',
                background: licensed ? 'rgba(125,57,236,0.1)' : 'transparent',
                color: licensed ? '#7D39EC' : '#fdfdfd',
                fontWeight: 700
              }}>
                {licensed ? 'LICENSED' : asset.licenseType}
              </span>
            </div>
          </div>
          <h3 className="font-display" style={{ fontSize: 18, color: '#fdfdfd', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.title}</h3>
          <p className="font-body-light" style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.5, marginBottom: 18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{asset.description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #333333', paddingTop: 14 }}>
          <div className="font-tech" style={{ fontSize: 11, color: '#71717a' }}>{asset.downloadCount} dl · {fmt.bytes(asset.totalSize)}</div>
          {showCreator && (
            <span className="font-tech" style={{ fontSize: 11, color: '#71717a' }}>BY {fmt.addr(asset.creatorWallet)}</span>
          )}
        </div>
      </div>
    </Card3D>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §16  INTEGRATED WEB3 ASSET DETAILED GLASSY MODAL
   ═══════════════════════════════════════════════════════════════════════ */
function AssetModal({ asset, walletAddress, onClose, onLicensed }: { asset: Asset; walletAddress: string | undefined; onClose: () => void; onLicensed?: (id: string) => void }) {
  const [licState, setLicState] = useState<'checking' | 'none' | 'owned'>('checking')
  const [isCreator, setIsCreator] = useState(false)
  const [buying, setBuying] = useState(false)
  const [reconState, setReconState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [reconPhase, setReconPhase] = useState('idle')
  const [reconProg, setReconProg] = useState(0)
  const [reconMsg, setReconMsg] = useState('')
  const [dlUrl, setDlUrl] = useState<string | null>(null)
  
  // Multi-sig co-signers approvals
  const [signatures, setSignatures] = useState<string[]>([])
  const [manualSignature, setManualSignature] = useState('')

  const [reshuffling, setReshuffling] = useState(false)
  const [reshuffleLogs, setReshuffleLogs] = useState<string[]>([])
  const [reshuffleProg, setReshuffleProg] = useState(0)
  const [countdown, setCountdown] = useState('24:00:00')

  useEffect(() => {
    const updateTimer = () => {
      const baseTime = new Date(asset.lastReshuffledAt || asset.registeredAt).getTime()
      const expiry = baseTime + 24 * 60 * 60 * 1000
      const diff = expiry - Date.now()
      if (diff <= 0) {
        setCountdown('Rotation Due Now')
      } else {
        const hrs = Math.floor(diff / (3600 * 1000))
        const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000))
        const secs = Math.floor((diff % (60 * 1000)) / 1000)
        setCountdown(`${String(hrs).padStart(2, '0')}h:${String(mins).padStart(2, '0')}m:${String(secs).padStart(2, '0')}s`)
      }
    }
    updateTimer()
    const timerId = setInterval(updateTimer, 1000)
    return () => clearInterval(timerId)
  }, [asset.lastReshuffledAt, asset.registeredAt])

  const handleReshuffle = async () => {
    if (!walletAddress) return
    setReshuffling(true)
    setReshuffleProg(0)
    setReshuffleLogs(['Initializing secure reshuffling enclave...'])
    try {
      const { jobId } = await nvApi.reshuffleAsset(asset.id, walletAddress) as { jobId: string }
      
      await pollJob(
        () => nvApi.pollReshuffle(jobId) as Promise<{ status: string; progress: number; logs: string[]; error?: string; message?: string }>,
        (j: any) => {
          setReshuffleProg(j.progress)
          setReshuffleLogs(j.logs || [])
        }
      )

      toast.success('Polynomial reshuffling complete! Node shares rotated.')
      onLicensed?.(asset.id)
    } catch (e) {
      toast.error(`Reshuffle failed: ${(e as Error).message}`)
      setReshuffleLogs(prev => [...prev, `[ERROR] ${(e as Error).message}`])
    } finally {
      setReshuffling(false)
    }
  }

  useEffect(() => {
    if (!walletAddress) {
      setLicState('none')
      return
    }
    nvApi.checkLicense(asset.id, walletAddress)
      .then((d: unknown) => {
        const { hasLicense, isCreator: ic } = d as { hasLicense: boolean; isCreator: boolean }
        setIsCreator(ic)
        setLicState(hasLicense || ic ? 'owned' : 'none')
      })
      .catch(() => setLicState('none'))
  }, [asset.id, walletAddress])

  const handlePurchase = async () => {
    if (!walletAddress) return
    setBuying(true)
    try {
      const result = await nvApi.purchaseLicense(asset.id, walletAddress) as { txHash: string }
      setLicState('owned')
      onLicensed?.(asset.id)
      toast.success(`License Purchased! Hash: ${fmt.hash(result.txHash)}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBuying(false)
    }
  }

  const handleSign = async () => {
    try {
      const provider = (window as any).ethereum
      if (!provider) {
        toast.error('No Web3 provider detected.')
        return
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      const message = `NullVault: Reconstruct asset ${asset.id}`
      const toHex = (str: string) => '0x' + Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('')
      
      const signature = await provider.request({
        method: 'personal_sign',
        params: [toHex(message), accounts[0]],
      })

      if (signature) {
        if (signatures.includes(signature)) {
          toast.error('Signature already gathered.')
          return
        }
        setSignatures(prev => [...prev, signature])
        toast.success('Approval Signed successfully!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Signature request aborted.')
    }
  }

  const handleAddManualSignature = () => {
    if (!manualSignature.trim()) return
    const sig = manualSignature.trim()
    if (signatures.includes(sig)) {
      toast.error('Already added.')
      return
    }
    setSignatures(p => [...p, sig])
    setManualSignature('')
    toast.success('External signature logged.')
  }

  const handleReconstruct = async () => {
    if (!walletAddress) return
    setReconState('running')
    setReconPhase('verifying')
    setReconProg(0)

    try {
      const { jobId } = await nvApi.startReconstruct(asset.id, walletAddress, signatures) as { jobId: string }
      const job = await pollJob(
        () => nvApi.pollReconstruct(jobId) as Promise<{ status: string; progress: number; downloadUrl?: string; error?: string; message?: string }>,
        j => {
          setReconPhase(j.status)
          setReconProg(j.progress)
          setReconMsg((j.message as string) || '')
        }
      ) as { status: string; progress: number; downloadUrl?: string }

      setDlUrl(job.downloadUrl || null)
      setReconState('done')
      toast.success('Decryption Matrix synthesized! Download active.')
    } catch (e) {
      setReconState('failed')
      setReconPhase('failed')
      toast.error(`Interpolation Failed: ${(e as Error).message}`)
    }
  }

  const handleDownload = () => {
    if (!dlUrl) return
    window.location.href = dlUrl
    toast.info(`Retrieving raw data stream...`)
    setReconState('idle')
    setReconPhase('idle')
    setReconProg(0)
    setDlUrl(null)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 300,
      background: 'rgba(29,29,31,0.5)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #222222',
        borderRadius: 18,
        width: '100%',
        maxWidth: 580,
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: `rgba(0, 0, 0, 0.15) 0px 20px 50px`,
        position: 'relative',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #222222' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: '#111111', border: '1px solid #333333', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {fmt.icon(asset.mimeType)}
            </div>
            <div>
              <h2 className="font-display" style={{ fontSize: 17, color: '#fdfdfd', fontWeight: 600 }}>{asset.title}</h2>
              <span className="font-tech" style={{ fontSize: 10, color: '#71717a' }}>{fmt.bytes(asset.totalSize)} · {asset.mimeType}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: '#111111', border: '1px solid #333333', borderRadius: '50%', color: '#fdfdfd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>×</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          <p className="font-body-light" style={{ fontSize: 15, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 24 }}>{asset.description}</p>
          
          <div className="grid-inputs" style={{ gap: 12, marginBottom: 24 }}>
            {[
              ['PRICE LICENSE', fmt.usd(asset.priceUSD), asset.priceUSD ? '#10b981' : undefined],
              ['STORY PIL MODEL', asset.licenseType, '#fdfdfd'],
              ['CREATOR IDENTITY', fmt.addr(asset.creatorWallet), undefined],
              ['SECURED DATE', fmt.date(asset.registeredAt), undefined]
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: '#111111', border: '1px solid #222222', borderRadius: 10, padding: '12px 16px' }}>
                <div className="font-tech" style={{ fontSize: 9, color: '#71717a', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c || '#fdfdfd' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: 10, padding: 18, marginBottom: 24 }}>
            <div className="font-tech" style={{ fontSize: 10, color: '#fdfdfd', marginBottom: 10, fontWeight: 600 }}>CRYPTOGRAPHIC METADATA</div>
            <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>➔ STORAGE PROTOCOL: SHAMIR SECRET SHARING SSS (10 PIECES)</div>
              <div>➔ RECONSTRUCTION REQUIREMENT: ANY 6 FRAGMENTS RETRIEVED</div>
              <div>➔ REGISTERED ASSET ID: {asset.ipId}</div>
              <div style={{ wordBreak: 'break-all' }}>➔ LOCATION MAP CID: {asset.locationMapCid}</div>
              {asset.isTeamIP && asset.teamSettings && (
                <div style={{ color: '#fdfdfd', fontWeight: 'bold', marginTop: 4 }}>
                  ➔ LOCK MODE: TEAM MULTI-SIGNATURE (THRESHOLD: {asset.teamSettings.threshold} OF {asset.teamSettings.coSigners.length})
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Rotation Control Panel */}
          <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: 10, padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="font-tech" style={{ fontSize: 10, color: '#fdfdfd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="anim-pulse" style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
                DYNAMIC FRAGMENT ROTATION HUD
              </div>
              <div className="font-tech" style={{ fontSize: 10, color: '#71717a' }}>
                Next reshuffle: {countdown}
              </div>
            </div>

            <p className="font-body-light" style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5, marginBottom: 12 }}>
              TEE Enclave periodically rotates the polynomial coefficients and reshuffles SSS shares on IPFS to dynamically revoke stale access pathways.
            </p>

            {reshuffleLogs.length > 0 && (
              <div style={{
                background: '#fdfdfd',
                color: '#111111',
                fontFamily: 'monospace',
                fontSize: 10,
                padding: 12,
                borderRadius: 8,
                maxHeight: 120,
                overflowY: 'auto',
                marginBottom: 12,
                border: '1px solid #3a3a3c',
                textAlign: 'left'
              }}>
                {reshuffleLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.includes('ERROR') || log.includes('failed') ? '#ff453a' : log.includes('complete') || log.includes('successfully') ? '#30d158' : '#111111', marginBottom: 4 }}>
                    {log}
                  </div>
                ))}
              </div>
            )}

            {reshuffling && (
              <div style={{ background: '#222222', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ background: '#fdfdfd', height: '100%', width: `${reshuffleProg}%`, transition: 'width 0.3s ease' }} />
              </div>
            )}

            {isCreator ? (
              <Btn full size="sm" onClick={handleReshuffle} disabled={reshuffling} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {reshuffling ? (
                  <>
                    <div className="anim-spin" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#1a1a1a', borderRadius: '50%' }} />
                    ROTATING SHARE DISTRIBUTION ({reshuffleProg}%)
                  </>
                ) : 'ROTATE NOW (MANUAL OVERRIDE)'}
              </Btn>
            ) : (
              <div style={{ textAlign: 'center', padding: '6px 0', border: '1px dashed #333333', borderRadius: 6 }}>
                <span className="font-tech" style={{ fontSize: 9, color: '#71717a' }}>
                  🔒 ONLY THE IP CREATOR CAN INITIATE MANUAL FRAGMENT ROTATION
                </span>
              </div>
            )}
          </div>

          {/* Action Trigger Flow */}
          {!walletAddress ? (
            <div style={{ padding: 16, background: '#111111', border: '1px solid #222222', borderRadius: 10, textAlign: 'center' }}>
              <div className="font-tech" style={{ fontSize: 11, color: '#71717a' }}>CONNECT WALLET TO START AUTHORIZATION</div>
            </div>
          ) : licState === 'checking' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', justifyContent: 'center' }}>
              <div className="anim-spin" style={{ width: 14, height: 14, border: `2px solid #fdfdfd20`, borderTopColor: '#fdfdfd', borderRadius: '50%' }} />
              <span className="font-tech" style={{ fontSize: 11, color: '#71717a' }}>RETRIEVING ACCESS LICENSE CONDITIONS...</span>
            </div>
          ) : licState === 'none' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(0, 102, 204, 0.05)', border: '1px solid rgba(0, 102, 204, 0.2)', borderRadius: 10, marginBottom: 16 }}>
                <span className="font-tech" style={{ fontSize: 11, color: '#fdfdfd', fontWeight: 600 }}>LICENSE REQUIRED</span>
                <span className="font-body-light" style={{ fontSize: 13, color: '#a1a1aa' }}>Purchase standard PIL terms to unlock reconstruction.</span>
              </div>
              <Btn full onClick={handlePurchase} disabled={buying}>
                {buying ? 'AUTHORIZING TRANSACTION...' : `MINT LICENSE TOKEN (${fmt.usd(asset.priceUSD)})`}
              </Btn>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 20 }}>
                <span style={{ color: '#10b981', fontSize: 14, fontWeight: 'bold' }}>✓</span>
                <span className="font-tech" style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>{isCreator ? 'CREATOR FULL CONTROL AUTHORIZED' : 'PIL TOKEN ACCESS VERIFIED'}</span>
              </div>

              {/* Multi-sig Approvals Gatherer panel */}
              {asset.isTeamIP && asset.teamSettings && reconState === 'idle' && !dlUrl && (
                <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222222', paddingBottom: 10, marginBottom: 12 }}>
                    <span className="font-tech" style={{ fontSize: 11, color: '#fdfdfd', fontWeight: 600 }}>SIGNATURES REGISTERED</span>
                    <span className="font-tech" style={{ fontSize: 11, color: '#fdfdfd', fontWeight: 600 }}>{signatures.length} / {asset.teamSettings.threshold}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 100, overflowY: 'auto' }}>
                    {asset.teamSettings.coSigners.map((signer, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#1a1a1a', border: '1px solid #222222', borderRadius: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a1a1aa' }}>{signer}</span>
                        <span className="font-tech" style={{ fontSize: 9, color: '#fdfdfd', fontWeight: 500 }}>CO-SIGNER #{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Btn size="sm" onClick={handleSign}>✍️ Sign with Connected Key</Btn>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Or input external co-signer key..."
                        value={manualSignature}
                        onChange={e => setManualSignature(e.target.value)}
                        style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333333', padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: '#fdfdfd', borderRadius: 8 }}
                      />
                      <Btn size="sm" onClick={handleAddManualSignature}>Log</Btn>
                    </div>
                  </div>
                  {signatures.length > 0 && (
                    <div style={{ borderTop: '1px solid #222222', marginTop: 12, paddingTop: 10 }}>
                      <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginBottom: 6 }}>CAPTURED KEYS:</div>
                      {signatures.map((sig, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#1a1a1a', border: '1px solid #222222', borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>{sig}</span>
                          <button onClick={() => setSignatures(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 12 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fragment Reconstruction Stage Visuals */}
              {reconState === 'running' && (
                <div style={{ marginBottom: 20 }}>
                  <ShardSphere3D progress={reconProg} phase={reconPhase} />
                  <TerminalLog phase={reconPhase} />
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#a1a1aa', marginTop: 12, textAlign: 'center' }}>
                    {reconMsg || 'Initializing secure enclaves...'}
                  </div>
                </div>
              )}

              {reconState === 'failed' && (
                <div style={{ padding: 14, background: '#fff2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 16 }}>
                  <div className="font-tech" style={{ fontSize: 11, color: '#b91c1c', textAlign: 'center', fontWeight: 600 }}>DECRYPTION ATTACK RESISTANCE ENFORCED: RECONSTRUCTION FAILED</div>
                </div>
              )}

              {reconState === 'done' && dlUrl && (
                <div style={{ padding: 20, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
                  <div className="font-tech" style={{ fontSize: 11, color: '#10b981', marginBottom: 12, fontWeight: 600 }}>FRACTURED MATRIX SYNTHESIZED SUCCESSFULLY</div>
                  <Btn full variant="primary" onClick={handleDownload} style={{ background: '#10b981', borderColor: '#10b981' }}>
                    DOWNLOAD PLAINTEXT SOURCE
                  </Btn>
                  <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginTop: 8 }}>TEE SECURITY DELETES RECONSTRUCTED DATA IN 5 MINUTES</div>
                </div>
              )}

              {(reconState === 'idle' || reconState === 'failed') && (
                <Btn
                  full
                  onClick={handleReconstruct}
                  disabled={asset.isTeamIP && asset.teamSettings ? signatures.length < asset.teamSettings.threshold : false}
                >
                  {asset.isTeamIP && asset.teamSettings && signatures.length < asset.teamSettings.threshold
                    ? `LOCK MODE ACTIVE: GATHER APPROVALS (${signatures.length}/${asset.teamSettings.threshold})`
                    : 'INTERPOLATE FRAGMENTS & DOWNLOAD'}
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §17  CYBERPUNK HERO VIEW WITH SCROLL FADEOUT PARALLAX
   ═══════════════════════════════════════════════════════════════════════ */
function Home({ setPage, assets }: { setPage: (p: string) => void; assets: Asset[] }) {
  const scrollY = useScrollRatio()

  const heroOpacity = Math.max(0, 1 - scrollY / 600)
  const heroScale = Math.max(0.92, 1 - scrollY / 2000)
  const heroTranslate = scrollY * 0.15

  const steps = [
    { n: '01', title: 'Plaintext Intake', body: 'Files up to 100MB are loaded securely inside transient client RAM memory enclaves. No disk writing occurs.', bg: '#111111', text: '#fdfdfd', numColor: '#fdfdfd' },
    { n: '02', title: 'Shamir SSS Shredding', body: 'The binary stream mathematically splits into 10 independent polynomial shares. No individual share holds any usable data.', bg: '#fdfdfd', text: '#1a1a1a', numColor: '#fdfdfd' },
    { n: '03', title: 'Decentralized Scatter', body: 'Fragments disperse across global IPFS nodes via secure Pinata gateways with persistent integrity hashes.', bg: '#1a1a1a', text: '#fdfdfd', numColor: '#71717a' },
    { n: '04', title: 'On-Chain Registration', body: 'Metadata and cryptographic location maps are sealed into Story Protocol\'s Confidential Data Rail (CDR) using global TEE DKG nodes.', bg: '#fdfdfd', text: '#1a1a1a', numColor: '#fdfdfd' },
    { n: '05', title: 'TEE Reconstruction', body: 'Upon license verification on-chain, enclaves retrieve fragments, run Lagrange interpolation in RAM, stream the download, and dissolve.', bg: '#111111', text: '#fdfdfd', numColor: '#fdfdfd' },
  ]

  const totalSize = assets.reduce((s, a) => s + a.totalSize, 0)

  return (
    <div style={{ background: '#1a1a1a' }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: '#1a1a1a',
        borderBottom: '1px solid #222222',
      }}>
        <div style={{
          position: 'relative',
          maxWidth: 1024,
          margin: '0 auto',
          width: '100%',
          padding: '0 24px',
          opacity: heroOpacity,
          transform: `translateY(${heroTranslate}px) scale(${heroScale})`,
          transition: 'opacity 0.15s ease-out',
        }}>
          <div className="grid-hero">
            {/* Left Content */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 99, background: '#111111', border: '1px solid #222222', marginBottom: 28 }}>
                <span className="anim-pulse" style={{ width: 6, height: 6, background: '#fdfdfd', borderRadius: '50%' }} />
                <span className="font-tech" style={{ fontSize: 10, color: '#fdfdfd', letterSpacing: '0.15em', fontWeight: 600 }}>NULLVAULT CORE v2.0</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 'clamp(44px, 6vw, 90px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, color: '#fdfdfd', marginBottom: 24 }}>
                Files that <br />
                <span style={{ color: '#71717a' }}>do not exist</span> <br />
                <span style={{ color: '#fdfdfd' }}>anywhere.</span>
              </h1>
              <p className="font-body-light" style={{ fontSize: 20, color: '#a1a1aa', lineHeight: 1.6, maxWidth: 540, marginBottom: 36 }}>
                Nothing is stored. Everything is preserved.<br />
                Data should not exist longer than the moment it is needed.
              </p>
              <div style={{ display: 'flex', gap: 16 }}>
                <Btn onClick={() => setPage('vault')} variant="primary" style={{ padding: '14px 28px' }}>
                  Open Vault ➔
                </Btn>
                <Btn onClick={() => setPage('explore')} variant="secondary" style={{ padding: '14px 28px' }}>
                  Browse Catalog
                </Btn>
              </div>
            </div>

            {/* Right: Math Visualization */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 280, height: 280 }}>
                {/* Visual Math Node Sphere */}
                <ShardSphere3D progress={50 + Math.sin(scrollY / 100) * 50} phase="fragmenting" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section style={{ background: '#111111', borderBottom: '1px solid #222222', padding: '40px 24px' }}>
        <div className="grid-stats" style={{ maxWidth: 1024, margin: '0 auto' }}>
          {[
            ['Security Threshold', 'K = 6', '#fdfdfd'],
            ['Total Fragments', 'N = 10', '#fdfdfd'],
            ['Active Assets', String(assets.length), '#fdfdfd'],
            ['Encrypted Weight', fmt.bytes(totalSize), '#fdfdfd'],
          ].map(([k, v, col]) => (
            <div key={k as string} style={{ textAlign: 'center', padding: '16px' }}>
              <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginBottom: 8, letterSpacing: '0.12em', fontWeight: 600 }}>{k.toUpperCase()}</div>
              <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: col }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Spec Gallery Rows */}
      <section style={{ background: '#1a1a1a' }}>
        {steps.map((s, idx) => {
          const isDark = s.bg === '#fdfdfd'
          return (
            <div key={idx} style={{ background: s.bg, color: s.text, borderBottom: '1px solid #222222', padding: '80px 24px' }}>
              <div className="grid-spec" style={{ maxWidth: 1024, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div className="font-tech" style={{ fontSize: 64, fontWeight: 700, color: s.numColor, opacity: 0.8, letterSpacing: '-0.05em' }}>{s.n}</div>
                  <div style={{ height: 40, width: 1, background: isDark ? '#3a3a3c' : '#333333' }} />
                  <div className="font-tech" style={{ fontSize: 12, letterSpacing: '0.2em', color: isDark ? '#71717a' : '#a1a1aa', fontWeight: 700 }}>PHASE</div>
                </div>
                <div>
                  <h3 className="font-display" style={{ fontSize: 24, fontWeight: 600, color: isDark ? '#1a1a1a' : '#fdfdfd', marginBottom: 12 }}>{s.title}</h3>
                  <p className="font-body-light" style={{ fontSize: 16, color: isDark ? '#333333' : '#a1a1aa', lineHeight: 1.6 }}>{s.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Bottom CTA Section */}
      <section style={{ padding: '120px 24px', background: '#111111', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 className="font-display" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', color: '#fdfdfd', marginBottom: 16 }}>
            Ready to secure your intellectual properties?
          </h2>
          <p className="font-body-light" style={{ fontSize: 18, color: '#a1a1aa', marginBottom: 32, lineHeight: 1.5 }}>
            No trace is left. No servers are trusted. Join the Confidential Data Rail.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn onClick={() => setPage('vault')} variant="primary" style={{ padding: '14px 28px' }}>
              Upload & Register IP ➔
            </Btn>
            <Btn onClick={() => setPage('explore')} variant="secondary" style={{ padding: '14px 28px' }}>
              Browse Catalog
            </Btn>
          </div>
        </div>
      </section>
    </div>
  )
}

function VaultPage({
  walletAddress,
  allAssets,
  onAssetCreated,
}: {
  walletAddress: string | undefined
  allAssets: Asset[]
  onAssetCreated: (a: Asset) => void
}) {
  const [tab, setTab] = useState('upload')
  const [myAssets, setMyAssets] = useState<Asset[]>([])
  const [myLoad, setMyLoad] = useState(false)
  const [licenses, setLicenses] = useState<License[]>([])
  const [licLoad, setLicLoad] = useState(false)
  
  const [step, setStep] = useState('drop')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    licenseType: 'commercial',
    priceUSD: '8',
    isTeamIP: false,
    coSigners: '',
    threshold: '2',
  })
  
  const [jobProg, setJobProg] = useState(0)
  const [jobPhase, setJobPhase] = useState('idle')
  const [jobMsg, setJobMsg] = useState('')
  const [doneAsset, setDoneAsset] = useState<Asset | null>(null)
  
  const [dragging, setDragging] = useState(false)
  const [selAsset, setSelAsset] = useState<Asset | null>(null)

  const loadMyAssets = useCallback(async () => {
    if (!walletAddress) return
    setMyLoad(true)
    try {
      setMyAssets(await nvApi.getMyAssets(walletAddress) as Asset[])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setMyLoad(false)
    }
  }, [walletAddress])

  const loadLicenses = useCallback(async () => {
    if (!walletAddress) return
    setLicLoad(true)
    try {
      setLicenses(await nvApi.getMyLicenses(walletAddress) as License[])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLicLoad(false)
    }
  }, [walletAddress])

  useEffect(() => {
    if (tab === 'assets') loadMyAssets()
  }, [tab, loadMyAssets])

  useEffect(() => {
    if (tab === 'licenses') loadLicenses()
  }, [tab, loadLicenses])

  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const [walletSigning, setWalletSigning] = useState(false)

  const resetUpload = () => {
    setFile(null)
    setForm({ title: '', description: '', licenseType: 'commercial', priceUSD: '8', isTeamIP: false, coSigners: '', threshold: '2' })
    setStep('drop')
    setJobProg(0)
    setJobPhase('idle')
    setJobMsg('')
    setDoneAsset(null)
    setPendingJobId(null)
    setWalletSigning(false)
  }

  const handleFileDrop = useCallback((f: File) => {
    setFile(f)
    setForm(p => ({ ...p, title: f.name.replace(/\.[^.]+$/, '') }))
    setStep('meta')
  }, [])

  const runFragmentation = async () => {
    if (!form.title.trim()) { toast.error('IP Title required.'); return }
    if (!form.description.trim()) { toast.error('IP Description required.'); return }
    if (!walletAddress) { toast.error('Connect authorized wallet.'); return }
    
    if (form.isTeamIP) {
      if (!form.coSigners.trim()) { toast.error('Please input co-signer wallets.'); return }
      const counts = form.coSigners.split(',').map(s => s.trim()).filter(Boolean).length
      const m = parseInt(form.threshold, 10)
      if (isNaN(m) || m < 1) { toast.error('Threshold must be positive.'); return }
      if (m > counts) { toast.error(`Threshold (${m}) exceeds co-signer count (${counts}).`); return }
    }

    setStep('running')
    setJobPhase('processing')
    setJobProg(0)

    try {
      const fd = new FormData()
      fd.append('file', file!)
      fd.append('title', form.title.trim())
      fd.append('description', form.description.trim())
      fd.append('licenseType', form.licenseType)
      fd.append('priceUSD', String(parseFloat(form.priceUSD) || 0))
      fd.append('isTeamIP', String(form.isTeamIP))
      
      if (form.isTeamIP) {
        fd.append('coSigners', form.coSigners)
        fd.append('threshold', form.threshold)
      }

      const { jobId } = await nvApi.uploadFile(fd, walletAddress) as { jobId: string }

      const phase1 = await pollJob(
        () => nvApi.pollUpload(jobId) as Promise<{ status: string; progress: number; message?: string; ipAsset?: Asset }>,
        j => {
          setJobPhase(j.status)
          setJobProg(j.progress)
          setJobMsg((j.message as string) || '')
        },
        850,
        ['complete', 'awaiting_registration']
      ) as { status: string; progress: number; ipAsset?: Asset }

      if (phase1.status === 'complete') {
        setDoneAsset(phase1.ipAsset || null)
        setStep('done')
        if (phase1.ipAsset) {
          onAssetCreated(phase1.ipAsset)
          setMyAssets(p => {
            if (p.some(x => x.id === phase1.ipAsset!.id)) return p
            return [phase1.ipAsset!, ...p]
          })
          toast.success(`Registered: "${phase1.ipAsset.title}"!`)
        }
        return
      }

      setPendingJobId(jobId)
      setStep('wallet_confirm')
      setJobMsg('Ready for on-chain registration — confirm in your wallet...')

    } catch (e) {
      toast.error(`Upload Aborted: ${(e as Error).message}`)
      setStep('meta')
      setJobPhase('idle')
    }
  }

  const handleWalletConfirm = async () => {
    if (!pendingJobId || !walletAddress) return
    setWalletSigning(true)
    setJobMsg('Signing Story Protocol transaction in wallet...')

    try {
      const ipId = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
      const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

      setJobMsg('Broadcasting to Story Protocol Aeneid...')
      await new Promise(r => setTimeout(r, 1200)) // Simulate wallet signing delay

      await nvApi.confirmRegistration(pendingJobId, ipId, txHash, walletAddress)

      setJobMsg('On-chain confirmation received. Finalizing...')

      const finalJob = await pollJob(
        () => nvApi.pollUpload(pendingJobId) as Promise<{ status: string; progress: number; message?: string; ipAsset?: Asset }>,
        j => {
          setJobPhase(j.status)
          setJobProg(j.progress)
          setJobMsg((j.message as string) || '')
        },
        500,
        ['complete']
      ) as { status: string; progress: number; ipAsset?: Asset }

      setDoneAsset(finalJob.ipAsset || null)
      setStep('done')
      if (finalJob.ipAsset) {
        onAssetCreated(finalJob.ipAsset)
        setMyAssets(p => {
          if (p.some(x => x.id === finalJob.ipAsset!.id)) return p
          return [finalJob.ipAsset!, ...p]
        })
        toast.success(`Registered: "${finalJob.ipAsset.title}"!`)
      }
    } catch (e) {
      toast.error(`Registration Failed: ${(e as Error).message}`)
      setStep('meta')
      setJobPhase('idle')
    } finally {
      setWalletSigning(false)
      setPendingJobId(null)
    }
  }

  if (!walletAddress) return (
    <div style={{ background: '#111111', minHeight: '85vh', padding: '80px 24px 80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        border: '1px solid #222222',
        borderRadius: 18,
        padding: '48px 32px',
        textAlign: 'center',
        background: '#1a1a1a',
        boxShadow: 'rgba(0, 0, 0, 0.04) 0px 4px 16px',
      }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔐</div>
        <h2 className="font-display" style={{ fontSize: 21, color: '#fdfdfd', marginBottom: 12, fontWeight: 600 }}>Command Center Secured</h2>
        <p className="font-body-light" style={{ fontSize: 15, color: '#71717a', lineHeight: 1.6 }}>
          Please connect your Web3 signature keys in the top navigation bar to initialize your creator command panel.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#111111', minHeight: '85vh', padding: '80px 24px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        
        {/* Header HUD */}
        <div className="flex-hud">
          <div>
            <span className="font-tech" style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>CREATOR HUBSYSTEM</span>
            <h1 className="font-display" style={{ fontSize: 36, color: '#fdfdfd', marginTop: 4, letterSpacing: '-0.02em', fontWeight: 600 }}>Command Center</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="font-tech" style={{ fontSize: 10, color: '#71717a' }}>ACTIVE TELEMETRY</span>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#fdfdfd', fontWeight: 600, marginTop: 4 }}>{fmt.addr(walletAddress)}</div>
          </div>
        </div>

        {/* Tab Selector Segmented Control */}
        <div style={{ display: 'flex', gap: 2, background: '#e3e3e9', border: '1px solid #333333', borderRadius: '10px', padding: 3, marginBottom: 32 }}>
          {[
            { key: 'upload', label: 'Register & Fragment IP' },
            { key: 'assets', label: 'My Registered Assets' },
            { key: 'licenses', label: 'My Licenses' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: tab === t.key ? '#1a1a1a' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === t.key ? 500 : 400,
                color: tab === t.key ? '#fdfdfd' : '#71717a',
                boxShadow: tab === t.key ? 'rgba(0, 0, 0, 0.04) 0px 3px 8px' : 'none',
                transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
              className="btn-press"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Upload Control Form */}
        {tab === 'upload' && (
          <div style={{ background: '#1a1a1a', border: '1px solid #222222', borderRadius: 18, padding: 32, boxShadow: 'rgba(0, 0, 0, 0.02) 0px 4px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222222', paddingBottom: 16, marginBottom: 28 }}>
              <h3 className="font-tech" style={{ color: '#fdfdfd', fontSize: 12, fontWeight: 600 }}>SECURE SHAMIR VAULT REGISTRATION</h3>
              <span className="font-tech" style={{ fontSize: 10, color: '#71717a' }}>TECTONIC CDR LAYER</span>
            </div>

            {step === 'drop' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFileDrop(e.dataTransfer.files[0]) }}
                onClick={() => document.getElementById('vault-file-inp')!.click()}
                style={{
                  border: `1.5px dashed ${dragging ? '#fdfdfd' : '#333333'}`,
                  borderRadius: 14,
                  background: dragging ? 'rgba(0,102,204,0.02)' : '#111111',
                  padding: '64px 32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
              >
                <input id="vault-file-inp" type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFileDrop(e.target.files[0]) }} />
                <div style={{ fontSize: 44, opacity: 0.3, marginBottom: 14 }}>📥</div>
                <h4 className="font-display" style={{ fontSize: 18, color: '#fdfdfd', marginBottom: 8, fontWeight: 500 }}>
                  {dragging ? 'Drop your file here' : 'Drag & drop file to encrypt'}
                </h4>
                <p className="font-body-light" style={{ fontSize: 14, color: '#71717a' }}>
                  Supports files up to 100MB. The file is split locally inside client memory enclaves.
                </p>
              </div>
            )}

            {step === 'meta' && file && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* File spec details card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#111111', border: '1px solid #222222', borderRadius: 12 }}>
                  <span style={{ fontSize: 22 }}>{fmt.icon(file.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fdfdfd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>SIZE: {fmt.bytes(file.size)} · FORMAT: {file.type || 'RAW BYTES'}</div>
                  </div>
                  <Btn variant="danger" size="sm" onClick={resetUpload}>Change</Btn>
                </div>

                <div>
                  <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>IP ASSET TITLE *</div>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Genesis Smart Contract IP"
                    style={{ width: '100%', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#fdfdfd' }}
                  />
                </div>

                <div>
                  <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>IP SECURE DESCRIPTION *</div>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe your intellectual property, licensing terms, and conditions."
                    style={{ width: '100%', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#fdfdfd', resize: 'vertical' }}
                  />
                </div>

                <div className="grid-inputs">
                  <div>
                    <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>PIL LICENSE CATEGORY</div>
                    <select
                      value={form.licenseType}
                      onChange={e => setForm(p => ({ ...p, licenseType: e.target.value }))}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#fdfdfd', cursor: 'pointer' }}
                    >
                      <option value="commercial">Commercial PIL</option>
                      <option value="non-commercial">Non-commercial PIL</option>
                      <option value="exclusive">Exclusive PIL</option>
                    </select>
                  </div>

                  <div>
                    <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>LICENSE PRICE (USD)</div>
                    <input
                      type="number"
                      min="0"
                      value={form.priceUSD}
                      onChange={e => setForm(p => ({ ...p, priceUSD: e.target.value }))}
                      style={{ width: '100%', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#fdfdfd' }}
                    />
                  </div>
                </div>

                {/* Team Multi-sig switch options */}
                <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="font-tech" style={{ fontSize: 12, color: '#fdfdfd', fontWeight: 600 }}>LOCK MODE: TEAM MULTI-SIGNATURE APPROVAL</span>
                      <span className="font-body-light" style={{ fontSize: 13, color: '#71717a', display: 'block', marginTop: 4 }}>Require co-signer signatures to rebuild fragmented file.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.isTeamIP}
                      onChange={e => setForm(p => ({ ...p, isTeamIP: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: '#fdfdfd', cursor: 'pointer' }}
                    />
                  </div>

                  {form.isTeamIP && (
                    <div style={{ borderTop: '1px solid #222222', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>CO-SIGNER ADDRESSES (COMMA-SEPARATED)</div>
                        <textarea
                          value={form.coSigners}
                          onChange={e => setForm(p => ({ ...p, coSigners: e.target.value }))}
                          placeholder="0x123..., 0xabc..."
                          rows={2}
                          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#fdfdfd', resize: 'none' }}
                        />
                      </div>
                      <div>
                        <div className="font-tech" style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 8, fontWeight: 600 }}>REQUIRED SIGNATURE THRESHOLD (M OF N)</div>
                        <input
                          type="number"
                          min="1"
                          value={form.threshold}
                          onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))}
                          style={{ width: '100%', border: '1px solid #333333', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#fdfdfd' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                  <Btn variant="danger" onClick={resetUpload} style={{ flex: 1 }}>Reset Form</Btn>
                  <Btn onClick={runFragmentation} style={{ flex: 2 }}>Shred & Register IP</Btn>
                </div>
              </div>
            )}

            {/* Stepper details */}
            {step === 'running' && (
              <div>
                <ShardSphere3D progress={jobProg} phase={jobPhase} />
                <TerminalLog phase={jobPhase} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, justifyContent: 'center' }}>
                  <span className="font-tech" style={{ fontSize: 12, color: '#fdfdfd', fontWeight: 600 }}>{jobMsg || 'Initializing secure enclave matrices...'}</span>
                </div>
              </div>
            )}

            {/* MetaMask Signing HUD */}
            {step === 'wallet_confirm' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: `#fdfdfd10`,
                  border: `2px solid #fdfdfd30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, margin: '0 auto 24px',
                  animation: walletSigning ? 'soft-pulse 1.5s ease-in-out infinite' : 'none',
                }}>
                  {walletSigning ? '⏳' : '🔏'}
                </div>
                <h3 className="font-display" style={{ fontSize: 21, color: '#fdfdfd', marginBottom: 8, fontWeight: 600 }}>
                  {walletSigning ? 'Signing transaction...' : 'Wallet confirmation required'}
                </h3>
                <p className="font-body-light" style={{ fontSize: 15, color: '#a1a1aa', marginBottom: 14, lineHeight: 1.5 }}>
                  {walletSigning
                    ? 'Broadcasting your IP registration to the Story Protocol Aeneid network...'
                    : 'Your file has been shredded via Shamir SSS, pinned to IPFS, and sealed in the CDR vault. Sign the on-chain transaction to mint your IP asset on Story Protocol.'}
                </p>
                <p className="font-tech" style={{ fontSize: 11, color: '#fdfdfd', marginBottom: 28, fontWeight: 600 }}>
                  {jobMsg}
                </p>

                <div style={{
                  background: '#111111', border: '1px solid #222222', borderRadius: 12,
                  padding: '16px 20px', marginBottom: 28, textAlign: 'left',
                }}>
                  {[
                    ['NETWORK', 'Story Protocol Aeneid (Testnet)'],
                    ['ACTION', 'mintAndRegisterIpAndAttachPilTerms'],
                    ['GAS FEES', 'Paid by connected wallet'],
                    ['SIGNER', walletAddress ? fmt.addr(walletAddress) : '—'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #222222' }}>
                      <span className="font-tech" style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#fdfdfd', fontFamily: 'monospace', fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <Btn variant="danger" onClick={() => { setStep('meta'); setJobPhase('idle'); setPendingJobId(null) }} style={{ flex: 1 }} disabled={walletSigning}>Cancel</Btn>
                  <Btn onClick={handleWalletConfirm} style={{ flex: 2 }} disabled={walletSigning}>
                    {walletSigning ? 'Signing...' : 'Sign & Register On-Chain'}
                  </Btn>
                </div>
              </div>
            )}

            {/* Complete Screen */}
            {step === 'done' && doneAsset && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#10b981', margin: '0 auto 20px', fontWeight: 'bold' }}>✓</div>
                <h3 className="font-display" style={{ fontSize: 21, color: '#fdfdfd', marginBottom: 8, fontWeight: 600 }}>IP Archive Established</h3>
                <p className="font-body-light" style={{ fontSize: 15, color: '#a1a1aa', marginBottom: 24 }}>Plaintext discarded. Secure shards distributed into void.</p>
                
                <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: 12, padding: '4px 20px', marginBottom: 28, textAlign: 'left' }}>
                  {[
                    ['IP ASSET TITLE', doneAsset.title],
                    ['ON-CHAIN IP ID', doneAsset.ipId, true],
                    ['MINT TRANSACTION', doneAsset.txHash, true],
                    ['TEE RECONSTRUCT MAP', doneAsset.locationMapCid, true],
                  ].map(([label, val, mono]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #222222' }}>
                      <span className="font-tech" style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>{label as string}</span>
                      <span style={{ fontSize: 13, fontFamily: mono ? 'monospace' : undefined, color: '#fdfdfd', fontWeight: 500 }}>{mono ? fmt.hash(val as string) : val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <Btn variant="danger" onClick={resetUpload} style={{ flex: 1 }}>Register New IP</Btn>
                  <Btn onClick={() => { loadMyAssets(); setTab('assets') }} style={{ flex: 1 }}>View Catalog Directory</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Registered Assets */}
        {tab === 'assets' && (
          myLoad ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', gap: 12, alignItems: 'center' }}>
              <div className="anim-spin" style={{ width: 16, height: 16, border: '2px solid #fdfdfd20', borderTopColor: '#fdfdfd', borderRadius: '50%' }} />
              <span className="font-tech" style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>RETRIEVING ASSET INDICES...</span>
            </div>
          ) : myAssets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', border: '1px solid #222222', borderRadius: 18, background: '#1a1a1a' }}>
              <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 14 }}>🗂</div>
              <h4 className="font-display" style={{ fontSize: 18, color: '#fdfdfd', marginBottom: 6, fontWeight: 500 }}>Directory Empty</h4>
              <p className="font-body-light" style={{ fontSize: 14, color: '#71717a', marginBottom: 20 }}>No intellectual properties registered on this account.</p>
              <Btn onClick={() => setTab('upload')}>Register First Asset</Btn>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {myAssets.map(a => (
                <AssetCard key={a.id} asset={a} onClick={() => setSelAsset(a)} showCreator={false} />
              ))}
            </div>
          )
        )}

        {/* Tab 3: My Purchased Licenses */}
        {tab === 'licenses' && (
          licLoad ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', gap: 12, alignItems: 'center' }}>
              <div className="anim-spin" style={{ width: 16, height: 16, border: '2px solid #fdfdfd20', borderTopColor: '#fdfdfd', borderRadius: '50%' }} />
              <span className="font-tech" style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>SYNCHRONIZING ACCESS TOKENS...</span>
            </div>
          ) : licenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', border: '1px solid #222222', borderRadius: 18, background: '#1a1a1a' }}>
              <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 14 }}>🔑</div>
              <h4 className="font-display" style={{ fontSize: 18, color: '#fdfdfd', marginBottom: 6, fontWeight: 500 }}>No Licenses Held</h4>
              <p className="font-body-light" style={{ fontSize: 14, color: '#71717a' }}>Browse the Explore catalog to purchase standard PIL terms.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginBottom: 28 }}>
                {licenses.map(l => {
                  const a = allAssets.find(x => x.id === l.ipAssetId)
                  return a ? <AssetCard key={l.id} asset={a} licensed onClick={() => setSelAsset(a)} /> : null
                })}
              </div>
              <div style={{ border: '1px solid #222222', borderRadius: 18, padding: 24, background: '#1a1a1a' }}>
                <div className="font-tech" style={{ fontSize: 11, color: '#fdfdfd', marginBottom: 18, fontWeight: 600 }}>AUTHORIZED LICENSE CONTRACT RECEIPTS</div>
                {licenses.map(l => {
                  const a = allAssets.find(x => x.id === l.ipAssetId)
                  return a ? (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #222222' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 18 }}>{fmt.icon(a.mimeType)}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fdfdfd' }}>{a.title}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717a', marginTop: 4 }}>
                            HASH: {fmt.hash(l.txHash)} · SECURED: {fmt.date(l.purchasedAt)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, color: '#10b981', fontWeight: 600 }}>{fmt.usd(l.pricePaid)}</span>
                        <Btn size="sm" onClick={() => setSelAsset(a)}>Reconstruct ➔</Btn>
                      </div>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          )
        )}

      </div>

      {selAsset && (
        <AssetModal
          asset={selAsset}
          walletAddress={walletAddress}
          onClose={() => setSelAsset(null)}
          onLicensed={loadLicenses}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §19  IP MARKETPLACE DIRECTORY (EXPLORE IP)
   ═══════════════════════════════════════════════════════════════════════ */
function ExplorePage({
  walletAddress,
  allAssets,
  loading,
}: {
  walletAddress: string | undefined
  allAssets: Asset[]
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selAsset, setSelAsset] = useState<Asset | null>(null)
  const [sessionLicensed, setSessionLicensed] = useState(new Set<string>())

  const filters = [
    { key: 'all', label: 'All Assets' },
    { key: 'image', label: 'Images' },
    { key: 'audio', label: 'Audio' },
    { key: 'video', label: 'Video' },
    { key: 'document', label: 'Docs' },
    { key: 'code', label: 'Code' },
  ]

  const filtered = allAssets.filter(a => {
    const q = search.toLowerCase()
    if (!a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
    if (filter === 'all') return true
    
    const mime = a.mimeType.toLowerCase()
    if (filter === 'image' && mime.startsWith('image/')) return true
    if (filter === 'audio' && mime.startsWith('audio/')) return true
    if (filter === 'video' && mime.startsWith('video/')) return true
    if (filter === 'document' && (mime.includes('pdf') || mime.includes('text'))) return true
    if (filter === 'code' && (mime.includes('javascript') || mime.includes('typescript') || mime.includes('json') || mime.includes('code'))) return true
    return false
  })

  return (
    <div style={{ background: '#111111', minHeight: '85vh', padding: '80px 24px 80px' }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="flex-hud">
          <div>
            <span className="font-tech" style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>IP REGISTRY DIRECTORY</span>
            <h1 className="font-display" style={{ fontSize: 36, color: '#fdfdfd', marginTop: 4, letterSpacing: '-0.02em', fontWeight: 600 }}>Explore IP Assets</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="font-tech" style={{ fontSize: 10, color: '#71717a' }}>STORY NETWORK INDEX</span>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fdfdfd', marginTop: 4 }}>{filtered.length} ASSETS ONLINE</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets by title or parameters..."
            style={{
              flex: 1,
              minWidth: 280,
              background: '#1a1a1a',
              border: '1px solid #333333',
              borderRadius: '9999px',
              padding: '10px 20px',
              fontSize: 14,
              color: '#fdfdfd',
              boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 2px inset',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 14px',
                  background: filter === f.key ? '#fdfdfd' : '#1a1a1a',
                  border: filter === f.key ? '1px solid #fdfdfd' : '1px solid #333333',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: filter === f.key ? '#1a1a1a' : '#a1a1aa',
                  boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 2px',
                  transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className="btn-press"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', gap: 12, alignItems: 'center' }}>
            <div className="anim-spin" style={{ width: 16, height: 16, border: '2px solid #fdfdfd20', borderTopColor: '#fdfdfd', borderRadius: '50%' }} />
            <span className="font-tech" style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>POLLING STORY CONTRACT REGISTRY...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: '1px solid #222222', borderRadius: 18, background: '#1a1a1a' }}>
            <div style={{ fontSize: 44, opacity: 0.3, marginBottom: 14 }}>🔍</div>
            <h4 className="font-display" style={{ fontSize: 18, color: '#fdfdfd', marginBottom: 6, fontWeight: 500 }}>No results found</h4>
            <p className="font-body-light" style={{ fontSize: 14, color: '#71717a' }}>Try adjusting your search queries or filter categories.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {filtered.map(a => (
              <AssetCard
                key={a.id}
                asset={a}
                licensed={sessionLicensed.has(a.id)}
                onClick={() => setSelAsset(a)}
              />
            ))}
          </div>
        )}
      </div>

      {selAsset && (
        <AssetModal
          asset={selAsset}
          walletAddress={walletAddress}
          onLicensed={id => setSessionLicensed(p => new Set([...p, id]))}
          onClose={() => setSelAsset(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §20  CLEAN STRIP FOOTER (APPLE DESIGN)
   ═══════════════════════════════════════════════════════════════════════ */
function Footer({ setPage }: { setPage: (p: string) => void }) {
  return (
    <footer style={{ borderTop: '1px solid #333333', paddingTop: 64, paddingBottom: 64, background: '#111111', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px' }}>
        <div className="grid-footer">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Poppins', sans-serif", color: '#fdfdfd', letterSpacing: '0.1em', display: 'flex', alignItems: 'center' }}><VoidLogo size={14} style={{ marginRight: 6 }} /> NULLVAULT</span>
            </div>
            <p className="font-body-light" style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, maxWidth: 320 }}>
              Nothing is stored. Everything is preserved. Cryptographically shredded file pieces reside in decentralized storage, verified on-chain.
            </p>
          </div>
          <div>
            <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginBottom: 16, fontWeight: 700 }}>MAP DIRECTORY</div>
            {['HOME', 'MY VAULT', 'EXPLORE IP'].map((l) => (
              <button
                key={l}
                onClick={() => setPage(l === 'HOME' ? 'home' : l === 'MY VAULT' ? 'vault' : 'explore')}
                className="font-tech"
                style={{ display: 'block', fontSize: 11, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0, textAlign: 'left', transition: 'color 0.2s', fontWeight: 600 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fdfdfd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
              >
                {l === 'HOME' ? 'Explore' : l === 'MY VAULT' ? 'My Vault' : 'Catalog'} ➔
              </button>
            ))}
          </div>
          <div>
            <div className="font-tech" style={{ fontSize: 10, color: '#71717a', marginBottom: 16, fontWeight: 700 }}>INFRASTRUCTURE</div>
            {['@piplabs/cdr-sdk', 'Story Protocol', 'Shamir SSS', 'Intel SGX TEE'].map(t => (
              <div key={t} className="font-tech" style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 10, fontWeight: 600 }}>{t}</div>
            ))}
          </div>
        </div>

        <div className="flex-footer-bottom">
          <span className="font-tech" style={{ fontSize: 11, color: '#71717a' }}>© 2026 NULLVAULT SECURITY GROUP</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="anim-pulse" style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} />
            <span className="font-tech" style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>SYSTEM STATE: NOMINAL</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §21  TEE BACKEND MONITOR BANNER
   ═══════════════════════════════════════════════════════════════════════ */
function OfflineBanner() {
  return (
    <div style={{
      background: '#fff2f2',
      borderBottom: '1px solid #fca5a5',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      position: 'relative',
      zIndex: 10,
    }}>
      <span className="font-tech" style={{ color: '#b91c1c', fontWeight: 'bold' }}>[ BACKEND OFFLINE ]</span>
      <span className="font-body-light" style={{ fontSize: 14, color: '#7f1d1d' }}>
        Decentralized SSS split enclaves are unreachable. Run: <code style={{ fontFamily: 'monospace', color: '#b91c1c', background: 'rgba(185,28,28,0.06)', padding: '2px 6px', borderRadius: 4 }}>npm run dev:backend</code>
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §22  APP ROOT ENVELOPE
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  useGlobalStyles()
  useLenisScroll()
  const { address, isConnected } = useAccount()
  const [page, setPage] = useState('home')
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [assetsLoad, setAssetsLoad] = useState(true)
  const [backendOk, setBackendOk] = useState(true)

  const loadAllAssets = useCallback(async () => {
    setAssetsLoad(true)
    try {
      setAllAssets(await nvApi.getAllAssets() as Asset[])
    } catch {
      // Offline logs
    } finally {
      setAssetsLoad(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    let timerId: any

    const checkHealth = () => {
      nvApi.health()
        .then(() => {
          if (active) {
            setBackendOk(true)
            // Once backend is online, also trigger loading of assets
            loadAllAssets()
          }
        })
        .catch(() => {
          if (active) {
            setBackendOk(false)
            timerId = setTimeout(checkHealth, 3000)
          }
        })
    }

    checkHealth()

    return () => {
      active = false
      clearTimeout(timerId)
    }
  }, [loadAllAssets])

  useEffect(() => {
    loadAllAssets()
  }, [loadAllAssets])

  const navigate = (id: string) => {
    setPage(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const walletAddress = isConnected ? address : undefined

  return (
    <div id="nv-root" style={{ background: BG_DARK, minHeight: '100vh', position: 'relative' }}>
      <div className="dot-grid" style={{ position: 'fixed', inset: 0, opacity: 0.45, pointerEvents: 'none', zIndex: 0 }} />
      <ParticleField />
      <InfinityLine />

      <ToastContainer />
      <Nav page={page} setPage={navigate} />
      
      {!backendOk && (
        <div style={{ marginTop: 52 }}>
          <OfflineBanner />
        </div>
      )}

      <div style={{ marginTop: backendOk ? 52 : 0 }}>
        <StatsTicker assets={allAssets} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {page === 'home' && (
          <div key="home" className="anim-page">
            <Home setPage={navigate} assets={allAssets} />
          </div>
        )}
        {page === 'vault' && (
          <div key="vault" className="anim-page">
            <VaultPage walletAddress={walletAddress} allAssets={allAssets} onAssetCreated={a => setAllAssets(p => [a, ...p])} />
          </div>
        )}
        {page === 'explore' && (
          <div key="explore" className="anim-page">
            <ExplorePage walletAddress={walletAddress} allAssets={allAssets} loading={assetsLoad} />
          </div>
        )}
      </div>
    </div>
  )
}
