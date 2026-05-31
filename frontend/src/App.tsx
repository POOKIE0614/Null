import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal, useAccountModal } from '@rainbow-me/rainbowkit'
import Lenis from 'lenis'

/* ═══════════════════════════════════════════════════════════════════════
   §1  GLOBAL STYLES + FONTS
   ═══════════════════════════════════════════════════════════════════════ */
function useFonts() {
  useEffect(() => {
    if (document.getElementById('nv-fonts')) return
    const s = document.createElement('style')
    s.id = 'nv-fonts'
    s.textContent = `
      @import url("https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800,900&display=swap");
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@400;500&display=swap");
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html.lenis,html.lenis body{height:auto}
      html.lenis{scroll-behavior:auto}
      #nv-root{font-family:'IBM Plex Sans',sans-serif;background:#050505;color:#e0e0e0;min-height:100vh;overflow-x:hidden}
      .d{font-family:'Cabinet Grotesk',system-ui,sans-serif;font-weight:900;letter-spacing:-0.04em}
      .di{font-family:'Cabinet Grotesk',system-ui,sans-serif;font-weight:400;font-style:italic;letter-spacing:-0.03em}
      .m{font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase}
      .b{font-family:'IBM Plex Sans',sans-serif;font-weight:300}

      @keyframes nv-pulse{0%,100%{opacity:1}50%{opacity:.2}}
      @keyframes nv-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      @keyframes nv-scan{0%{top:-2px}100%{top:100%}}
      @keyframes nv-fadein{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
      @keyframes nv-spin{to{transform:rotate(360deg)}}
      @keyframes nv-ti{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
      @keyframes nv-to{from{opacity:1}to{opacity:0;transform:translateX(32px)}}
      @keyframes nv-cube{0%{transform:rotateX(-15deg) rotateY(0deg)}100%{transform:rotateX(-15deg) rotateY(360deg)}}
      @keyframes nv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
      @keyframes nv-glow{0%,100%{box-shadow:0 0 30px rgba(255,26,26,.08)}50%{box-shadow:0 0 60px rgba(255,26,26,.2)}}
      @keyframes nv-dot-pulse{0%,100%{opacity:.12;transform:scale(1)}50%{opacity:.4;transform:scale(1.6)}}
      @keyframes nv-ring{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
      @keyframes nv-line-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
      @keyframes nv-hero-in{from{opacity:0;transform:translateY(60px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}

      .nv-pulse{animation:nv-pulse 2.5s ease-in-out infinite}
      .nv-ticker{animation:nv-ticker 50s linear infinite}
      .nv-fadein{animation:nv-fadein .7s ease-out both}

      .nv-dot-grid{
        background-image:radial-gradient(circle 1px,rgba(255,26,26,.045) 1px,transparent 1px);
        background-size:52px 52px;
      }

      input,textarea,select{outline:none;font-family:'IBM Plex Sans',sans-serif;color:#e0e0e0;background:transparent}
      input::placeholder,textarea::placeholder{color:rgba(255,255,255,.18)}
      select option{background:#111;color:#fff}
      button{cursor:pointer;font-family:inherit}
      ::-webkit-scrollbar{width:3px}
      ::-webkit-scrollbar-thumb{background:rgba(255,26,26,.25);border-radius:2px}
      ::-webkit-scrollbar-track{background:#050505}
    `
    document.head.appendChild(s)
  }, [])
}

/* ═══════════════════════════════════════════════════════════════════════
   §2  LENIS SMOOTH SCROLL
   ═══════════════════════════════════════════════════════════════════════ */
function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.4, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true })
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])
}

/* ═══════════════════════════════════════════════════════════════════════
   §3  PARALLAX HOOK
   ═══════════════════════════════════════════════════════════════════════ */
function useScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const fn = () => setY(window.scrollY)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return y
}

/* ═══════════════════════════════════════════════════════════════════════
   §4  DESIGN TOKENS — GREY + RED
   ═══════════════════════════════════════════════════════════════════════ */
const BDR      = '1px solid rgba(255,255,255,0.05)'
const BDR_R    = '1px solid rgba(255,26,26,0.15)'
const RED      = '#FF1A1A'
const RED_DIM  = '#B81414'
const RED_SOFT = 'rgba(255,26,26,.08)'
const GREEN    = '#3DDB6F'
const AMBER    = '#F5A623'
const G = { 100:'#e0e0e0', 200:'#bbb', 300:'#888', 400:'#666', 500:'#444', 600:'#2a2a2a', 700:'#1a1a1a', 800:'#111', 900:'#0a0a0a' }

/* ═══════════════════════════════════════════════════════════════════════
   §5  API LAYER  (unchanged business logic)
   ═══════════════════════════════════════════════════════════════════════ */
const API = '/api'
async function apiFetch(method: string, path: string, opts: { walletAddress?: string; body?: unknown; isForm?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = {}
  if (opts.walletAddress) headers['x-wallet-address'] = opts.walletAddress
  if (!opts.isForm && opts.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${path}`, { method, headers, body: opts.isForm ? (opts.body as FormData) : opts.body ? JSON.stringify(opts.body) : undefined })
  let json: { ok: boolean; data: unknown; error?: string }
  try { json = await res.json() as typeof json } catch { throw new Error(`Backend unreachable (HTTP ${res.status}).`) }
  if (!json.ok) throw new Error(json.error || `Request failed: ${path}`)
  return json.data
}
function pollJob(fetchFn: () => Promise<{ status: string; progress: number;[k: string]: unknown }>, onUpdate: (j: { status: string; progress: number;[k: string]: unknown }) => void, ms = 800): Promise<{ status: string; progress: number;[k: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try { const j = await fetchFn(); onUpdate(j); if (j.status === 'complete') { clearInterval(id); resolve(j) } if (j.status === 'failed') { clearInterval(id); reject(new Error((j as Record<string, string>).error || 'Job failed')) } } catch (e) { clearInterval(id); reject(e) }
    }, ms)
  })
}
const nvApi = {
  health: () => apiFetch('GET', '/health'),
  getAllAssets: () => apiFetch('GET', '/upload/assets'),
  getMyAssets: (w: string) => apiFetch('GET', '/upload/assets/creator', { walletAddress: w }),
  pollUpload: (id: string) => apiFetch('GET', `/upload/job/${id}`),
  uploadFile: (fd: FormData, w: string) => apiFetch('POST', '/upload', { walletAddress: w, body: fd, isForm: true }),
  getMyLicenses: (w: string) => apiFetch('GET', '/access/licenses', { walletAddress: w }),
  checkLicense: (aid: string, w: string) => apiFetch('GET', `/access/license/${aid}/check`, { walletAddress: w }),
  purchaseLicense: (aid: string, w: string) => apiFetch('POST', `/access/license/${aid}`, { walletAddress: w }),
  startReconstruct: (aid: string, w: string, signatures?: string[]) => apiFetch('POST', `/access/reconstruct/${aid}`, { walletAddress: w, body: { signatures } }),
  pollReconstruct: (id: string) => apiFetch('GET', `/access/reconstruct/job/${id}`),
}

/* ═══════════════════════════════════════════════════════════════════════
   §6  TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */
let _addToast = (_: { msg: string; type: string }) => { }
const toast = { success: (msg: string) => _addToast({ msg, type: 'success' }), error: (msg: string) => _addToast({ msg, type: 'error' }), info: (msg: string) => _addToast({ msg, type: 'info' }) }
interface ToastItem { id: number; msg: string; type: string; leaving: boolean }
function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    _addToast = ({ msg, type }) => { const id = Date.now() + Math.random(); setToasts(p => [...p, { id, msg, type, leaving: false }]); setTimeout(() => { setToasts(p => p.map(t => t.id === id ? { ...t, leaving: true } : t)); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 350) }, 3800) }
  }, [])
  const COLOR: Record<string, string> = { success: GREEN, error: RED, info: '#888' }
  const ICON: Record<string, string> = { success: '✓', error: '✕', info: '◆' }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', maxWidth: 380 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', background: 'rgba(10,10,10,.95)', backdropFilter: 'blur(12px)', border: `1px solid ${COLOR[t.type]}33`, pointerEvents: 'all', animation: t.leaving ? 'nv-to .35s ease-in forwards' : 'nv-ti .35s ease-out both' }}>
          <span style={{ color: COLOR[t.type], fontFamily: "'JetBrains Mono',monospace", fontSize: 11, flexShrink: 0 }}>{ICON[t.type]}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.5 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  TYPES + HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
type TeamSettings = { coSigners: string[]; threshold: number }
type Asset = { id: string; ipId: string; title: string; description: string; creatorWallet: string; mimeType: string; originalName: string; totalSize: number; licenseType: string; priceUSD: number; registeredAt: string; locationMapCid: string; txHash: string; downloadCount: number; royaltiesEarned: number; isTeamIP?: boolean; teamSettings?: TeamSettings }
type License = { id: string; ipAssetId: string; buyerWallet: string; purchasedAt: string; expiresAt: string | null; txHash: string; pricePaid: number; asset?: Asset }
const fmt = {
  bytes: (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + 'GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + 'MB' : b >= 1e3 ? Math.round(b / 1e3) + 'KB' : b + 'B',
  usd: (v: number) => v === 0 ? 'Free' : '$' + v.toLocaleString('en'),
  addr: (a: string) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '—',
  hash: (h: string) => h ? h.slice(0, 10) + '…' + h.slice(-6) : '—',
  date: (d: string) => new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }),
  mime: (t: string) => t.startsWith('image/') ? 'Image' : t.startsWith('audio/') ? 'Audio' : t.startsWith('video/') ? 'Video' : t.includes('pdf') ? 'PDF' : t.includes('text') ? 'Text' : 'Binary',
  icon: (t: string) => t.startsWith('image/') ? '🖼' : t.startsWith('audio/') ? '🎵' : t.startsWith('video/') ? '🎬' : t.includes('pdf') ? '📄' : t.includes('text') || t.includes('javascript') ? '💾' : '📦',
  mf: (t: string) => t.startsWith('image/') ? 'image' : t.startsWith('audio/') ? 'audio' : t.startsWith('video/') ? 'video' : t.includes('pdf') || t.includes('text') ? 'document' : 'code',
  lc: (l: string) => l === 'commercial' ? GREEN : l === 'exclusive' ? RED : G[300],
}

/* ═══════════════════════════════════════════════════════════════════════
   §8  UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */
function Badge({ children, color = RED }: { children: React.ReactNode; color?: string }) {
  return <span className="m" style={{ fontSize: 9, padding: '3px 10px', border: `1px solid ${color}33`, color, background: `${color}0a`, letterSpacing: '0.1em' }}>{children}</span>
}
function Btn({ children, onClick, disabled, variant = 'primary', full, size = 'md', style: sx = {} }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; full?: boolean; size?: string; style?: React.CSSProperties }) {
  const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 32px' : '11px 22px'
  const fz = size === 'sm' ? 12 : size === 'lg' ? 14 : 13
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: pad, fontSize: fz, fontWeight: 500, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'all .25s', ...(full ? { width: '100%' } : {}), ...sx }
  const v: Record<string, React.CSSProperties> = {
    primary: { background: RED, border: `1px solid ${RED}`, color: '#fff' },
    secondary: { background: 'transparent', border: BDR, color: G[300] },
    ghost: { background: 'rgba(255,255,255,.04)', border: BDR, color: G[200] },
    danger: { background: 'transparent', border: `1px solid ${RED}44`, color: RED },
  }
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...v[variant] }} onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; if (variant === 'primary') e.currentTarget.style.boxShadow = `0 8px 32px ${RED}33` } }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>{children}</button>
}
function Spinner({ color = RED, size = 14 }: { color?: string; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, border: `2px solid ${color}22`, borderTopColor: color, borderRadius: '50%', animation: 'nv-spin .9s linear infinite', flexShrink: 0 }} />
}
function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: string }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: BDR }}><span className="m" style={{ fontSize: 9, color: G[400] }}>{label}</span><span style={{ fontSize: 13, color: highlight || G[100], fontFamily: mono ? "'JetBrains Mono',monospace" : undefined }}>{value}</span></div>)
}
function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (<div style={{ textAlign: 'center', padding: '80px 32px' }}><div style={{ fontSize: 48, opacity: .12, marginBottom: 24 }}>{icon}</div><div className="d" style={{ fontSize: 24, marginBottom: 12, color: G[100] }}>{title}</div><div className="b" style={{ color: G[400], fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>{body}</div>{action}</div>)
}
function OfflineBanner() {
  return (<div style={{ background: RED_SOFT, borderBottom: BDR_R, padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: RED }}>✕</span><span className="m" style={{ fontSize: 10, color: RED }}>BACKEND OFFLINE</span><span className="b" style={{ fontSize: 13, color: G[300] }}>Start the server: <code style={{ fontFamily: "'JetBrains Mono',monospace", color: RED }}>cd backend && npm run dev</code></span></div>)
}

/* ═══════════════════════════════════════════════════════════════════════
   §9  3D CARD TILT
   ═══════════════════════════════════════════════════════════════════════ */
function Card3D({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    ref.current.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`
  }
  const handleLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(700px) rotateY(0) rotateX(0) translateY(0)' }
  return <div ref={ref} className={className} onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ transition: 'transform .2s ease-out', transformStyle: 'preserve-3d', willChange: 'transform', ...style }}>{children}</div>
}

/* ═══════════════════════════════════════════════════════════════════════
   §10  3D ROTATING CUBE
   ═══════════════════════════════════════════════════════════════════════ */
function Cube3D({ size = 180, scrollY = 0 }: { size?: number; scrollY?: number }) {
  const half = size / 2
  const face = (tx: string): React.CSSProperties => ({ position: 'absolute', width: size, height: size, border: '1px solid rgba(255,26,26,.18)', background: 'rgba(255,26,26,.02)', backdropFilter: 'blur(1px)', transform: tx })
  return (
    <div style={{ perspective: 900, width: size, height: size, transform: `translateY(${scrollY * 0.08}px)` }}>
      <div style={{ width: size, height: size, position: 'relative', transformStyle: 'preserve-3d', animation: 'nv-cube 30s linear infinite' }}>
        <div style={face(`rotateY(0deg) translateZ(${half}px)`)} />
        <div style={face(`rotateY(90deg) translateZ(${half}px)`)} />
        <div style={face(`rotateY(180deg) translateZ(${half}px)`)} />
        <div style={face(`rotateY(270deg) translateZ(${half}px)`)} />
        <div style={face(`rotateX(90deg) translateZ(${half}px)`)} />
        <div style={face(`rotateX(-90deg) translateZ(${half}px)`)} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §11  FLOATING PARTICLES
   ═══════════════════════════════════════════════════════════════════════ */
function ParticleField() {
  const particles = useRef(Array.from({ length: 35 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, delay: Math.random() * 6, dur: 3 + Math.random() * 5, sz: 1 + Math.random() * 2 }))).current
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {particles.map((p, i) => <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: p.sz, height: p.sz, borderRadius: '50%', background: RED, animation: `nv-dot-pulse ${p.dur}s ease-in-out ${p.delay}s infinite` }} />)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §12  INFINITE VERTICAL LINE
   ═══════════════════════════════════════════════════════════════════════ */
function InfinityLine() {
  return <div style={{ position: 'fixed', left: '50%', top: 0, bottom: 0, width: 1, background: 'linear-gradient(to bottom, transparent 0%, rgba(255,26,26,.06) 15%, rgba(255,26,26,.06) 85%, transparent 100%)', pointerEvents: 'none', zIndex: 0 }} />
}

/* ═══════════════════════════════════════════════════════════════════════
   §13  WALLET BUTTON
   ═══════════════════════════════════════════════════════════════════════ */
function WalletButton({ onConnect, onDisconnect }: { onConnect?: (addr: string) => void; onDisconnect?: () => void }) {
  const { address, isConnected, isConnecting, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn) }, [])
  useEffect(() => { if (isConnected && address) onConnect?.(address); else if (!isConnected && !isConnecting) onDisconnect?.() }, [isConnected, isConnecting, address])
  const wrongChain = chain && chain.id !== 1513

  if (isConnecting) return (<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', border: BDR, background: 'rgba(255,255,255,.02)' }}><Spinner size={12} /><span className="m" style={{ fontSize: 11, color: G[400] }}>Connecting…</span></div>)
  if (!isConnected) return (<button onClick={openConnectModal} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', background: 'rgba(255,255,255,.03)', border: BDR, transition: 'all .25s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.background = RED_SOFT }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: G[500], display: 'block' }} /><span className="m" style={{ fontSize: 11, color: G[300] }}>Connect Wallet</span></button>)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', background: 'rgba(255,255,255,.03)', border: `1px solid ${wrongChain ? RED + '55' : 'rgba(255,255,255,.08)'}`, transition: 'all .25s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = wrongChain ? RED : 'rgba(255,26,26,.4)')} onMouseLeave={e => (e.currentTarget.style.borderColor = wrongChain ? RED + '55' : 'rgba(255,255,255,.08)')}>
        <span className="nv-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: wrongChain ? RED : GREEN, display: 'block' }} />
        <span className="m" style={{ fontSize: 11, color: wrongChain ? RED : G[100] }}>{wrongChain ? 'Wrong Network' : fmt.addr(address!)}</span>
        <span style={{ color: G[500], fontSize: 9, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 52, width: 280, background: '#0a0a0a', border: BDR, zIndex: 200, backdropFilter: 'blur(20px)' }}>
          <div style={{ padding: '16px 18px', borderBottom: BDR }}>
            <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 8 }}>CONNECTED</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: RED, wordBreak: 'break-all', marginBottom: 4 }}>{address}</div>
            <div style={{ fontSize: 12, color: wrongChain ? RED : G[400] }}>{chain?.name ?? 'Unknown'}</div>
            {wrongChain && <div className="b" style={{ fontSize: 11, color: G[300], marginTop: 8 }}>Switch to <strong style={{ color: '#fff' }}>Story Aeneid Testnet</strong> (1513)</div>}
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => { openAccountModal?.(); setOpen(false) }} style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: BDR, fontSize: 12, color: G[300], textAlign: 'center' }}>View on Explorer ↗</button>
            <button onClick={() => { disconnect(); setOpen(false); toast.info('Wallet disconnected') }} style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: `1px solid ${RED}33`, fontSize: 12, color: RED, textAlign: 'center' }}>Disconnect</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §14  NAVIGATION
   ═══════════════════════════════════════════════════════════════════════ */
function Nav({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 40); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn) }, [])
  const go = (id: string) => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? 'rgba(5,5,5,.92)' : 'transparent', backdropFilter: scrolled ? 'blur(24px) saturate(1.5)' : 'none', borderBottom: scrolled ? BDR : 'none', transition: 'all .4s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 40px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
        <button onClick={() => go('home')} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none' }}>
          <span className="nv-pulse" style={{ width: 10, height: 10, background: RED, display: 'block' }} />
          <span className="m" style={{ fontSize: 13, letterSpacing: '0.3em', color: '#fff' }}>NULLVAULT</span>
        </button>
        <nav style={{ display: 'flex', gap: 32 }}>
          {[{ id: 'home', label: 'Home' }, { id: 'vault', label: 'My Vault' }, { id: 'explore', label: 'Explore IP' }].map(l => (
            <button key={l.id} onClick={() => go(l.id)} className="m" style={{ background: 'none', border: 'none', fontSize: 13, color: page === l.id ? RED : G[400], borderBottom: page === l.id ? `2px solid ${RED}` : '2px solid transparent', paddingBottom: 4, transition: 'all .25s' }}
              onMouseEnter={e => { if (page !== l.id) (e.currentTarget as HTMLButtonElement).style.color = G[100] }} onMouseLeave={e => { if (page !== l.id) (e.currentTarget as HTMLButtonElement).style.color = G[400] }}>{l.label}</button>
          ))}
        </nav>
        <WalletButton onConnect={addr => toast.success(`Connected: ${fmt.addr(addr)}`)} onDisconnect={() => toast.info('Wallet disconnected')} />
      </div>
    </header>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §15  INFINITE TICKER
   ═══════════════════════════════════════════════════════════════════════ */
function StatsTicker({ assets }: { assets: Asset[] }) {
  const tv = assets.reduce((s, a) => s + a.priceUSD, 0)
  const ts = assets.reduce((s, a) => s + a.totalSize, 0)
  const td = assets.reduce((s, a) => s + a.downloadCount, 0)
  const items = [`${assets.length} IP assets protected`, `${fmt.usd(tv)} total value`, `${fmt.bytes(ts)} fragmented`, `${td} downloads`, 'Shamir SSS · N=10 K=6', 'Story Protocol CDR', 'Pinata IPFS', 'TEE-only reconstruction']
  const all = [...items, ...items, ...items]
  return (
    <div style={{ background: 'rgba(255,26,26,.02)', borderBottom: BDR, borderTop: BDR, overflow: 'hidden', height: 38, display: 'flex', alignItems: 'center' }}>
      <div className="nv-ticker" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
        {all.map((item, i) => (<span key={i} className="m" style={{ fontSize: 9, color: G[400], padding: '0 32px', display: 'inline-flex', alignItems: 'center', gap: 16, flexShrink: 0 }}><span style={{ width: 3, height: 3, background: RED, display: 'inline-block' }} />{item}</span>))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §16  FRAGMENT VISUALISER
   ═══════════════════════════════════════════════════════════════════════ */
function FragmentViz({ phase, progress }: { phase: string; progress: number }) {
  const LABELS: Record<string, string> = { idle: 'Ready', processing: 'Fingerprinting…', fragmenting: 'Shamir SSS…', distributing: 'Uploading to IPFS…', registering: 'Registering on Story Protocol…', assembling: 'Lagrange interpolation…', complete: 'Verified ✓', verifying: 'Verifying license…', fetching: 'Fetching fragments…', failed: 'Failed' }
  const ICONS: Record<string, string> = { idle: '○', processing: '⬡', fragmenting: '⬡', distributing: '⟳', registering: '◐', verifying: '◐', fetching: '◑', assembling: '◎', complete: '✓', failed: '✕' }
  const nodes = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; return { x: 150 + Math.cos(a) * 108, y: 150 + Math.sin(a) * 108 } })
  const aC = Math.round((progress / 100) * 10)
  const isDone = phase === 'complete'
  const cColor = isDone ? GREEN : RED
  const circ = 2 * Math.PI * 38
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 280, height: 'auto', display: 'block', margin: '0 auto' }}>
        {phase !== 'idle' && nodes.map((n, i) => <line key={`l${i}`} x1="150" y1="150" x2={n.x} y2={n.y} stroke={i < aC ? `${cColor}44` : 'rgba(255,255,255,.04)'} strokeWidth=".6" strokeDasharray="3 5" />)}
        {nodes.map((n, i) => { const on = i < aC && phase !== 'idle'; return (<g key={i}>{on && <circle cx={n.x} cy={n.y} r="20" fill={`${cColor}12`} />}<circle cx={n.x} cy={n.y} r="14" fill="#050505" stroke={on ? cColor : 'rgba(255,255,255,.08)'} strokeWidth={on ? 1.5 : .8} /><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fill={on ? cColor : G[500]} fontSize="8" fontFamily="JetBrains Mono,monospace">N{i + 1}</text>{on && isDone && <text x={n.x} y={n.y + 22} textAnchor="middle" fill={GREEN} fontSize="7">✓</text>}</g>) })}
        {phase !== 'idle' && <circle cx="150" cy="150" r="50" fill={`${cColor}08`} />}
        {progress > 0 && <circle cx="150" cy="150" r="38" fill="none" stroke={cColor} strokeWidth="2" strokeDasharray={`${(progress / 100) * circ} ${circ}`} strokeDashoffset={circ * .25} strokeLinecap="round" style={{ transition: 'stroke-dasharray .4s' }} />}
        <circle cx="150" cy="150" r="30" fill="#050505" stroke={phase !== 'idle' ? cColor : 'rgba(255,255,255,.08)'} strokeWidth={phase !== 'idle' ? 1.5 : .8} />
        <text x="150" y="150" textAnchor="middle" dominantBaseline="middle" fill={phase !== 'idle' ? cColor : G[500]} fontSize="18">{ICONS[phase] ?? '○'}</text>
      </svg>
      <p className="m" style={{ fontSize: 9, color: G[400], marginTop: 8, textTransform: 'none', letterSpacing: 'normal', fontFamily: "'JetBrains Mono',monospace" }}>{LABELS[phase] ?? phase}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §17  ASSET CARD (3D tilt)
   ═══════════════════════════════════════════════════════════════════════ */
function AssetCard({ asset, onClick, showCreator = true, licensed = false }: { asset: Asset; onClick: () => void; showCreator?: boolean; licensed?: boolean }) {
  return (
    <Card3D style={{ cursor: 'pointer' }}>
      <div onClick={onClick} style={{ background: 'rgba(255,255,255,.02)', border: BDR, padding: 22, transition: 'all .3s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,26,26,.2)'; e.currentTarget.style.background = 'rgba(255,26,26,.03)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: RED_SOFT, border: BDR_R, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{fmt.icon(asset.mimeType)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, color: G[100] }}>{asset.title}</div>
              <span className="m" style={{ fontSize: 9, color: G[400] }}>{fmt.mime(asset.mimeType)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: asset.priceUSD ? GREEN : G[400], marginBottom: 6 }}>{fmt.usd(asset.priceUSD)}</div>
            <Badge color={fmt.lc(asset.licenseType)}>{asset.licenseType}</Badge>
          </div>
        </div>
        <p className="b" style={{ fontSize: 12, color: G[400], lineHeight: 1.7, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{asset.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: BDR, paddingTop: 14 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: G[400] }}><span><strong style={{ color: G[200] }}>{asset.downloadCount}</strong> dl</span><span>{fmt.bytes(asset.totalSize)}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {licensed && <Badge color={GREEN}>LICENSED</Badge>}
            {showCreator && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: G[500] }}>{fmt.addr(asset.creatorWallet)}</span>}
          </div>
        </div>
      </div>
    </Card3D>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §18  ASSET MODAL
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
  const [signatures, setSignatures] = useState<string[]>([])
  const [manualSignature, setManualSignature] = useState('')

  useEffect(() => { if (!walletAddress) { setLicState('none'); return }; nvApi.checkLicense(asset.id, walletAddress).then((d: unknown) => { const { hasLicense, isCreator: ic } = d as { hasLicense: boolean; isCreator: boolean }; setIsCreator(ic); setLicState(hasLicense || ic ? 'owned' : 'none') }).catch(() => setLicState('none')) }, [asset.id, walletAddress])

  const handlePurchase = async () => { if (!walletAddress) return; setBuying(true); try { const result = await nvApi.purchaseLicense(asset.id, walletAddress) as { txHash: string }; setLicState('owned'); onLicensed?.(asset.id); toast.success(`License purchased! Tx: ${fmt.hash(result.txHash)}`) } catch (e) { toast.error((e as Error).message) } finally { setBuying(false) } }

  const handleSign = async () => { try { const provider = (window as any).ethereum; if (!provider) { toast.error('No Ethereum provider found.'); return }; const accounts = await provider.request({ method: 'eth_requestAccounts' }); const account = accounts[0]; const message = `NullVault: Reconstruct asset ${asset.id}`; const toHex = (str: string) => '0x' + Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join(''); const signature = await provider.request({ method: 'personal_sign', params: [toHex(message), account] }); if (signature) { if (signatures.includes(signature)) { toast.error('Signature already added'); return }; setSignatures(prev => [...prev, signature]); toast.success('Signed!') } } catch (err: any) { toast.error(err.message || 'Signing failed') } }

  const handleAddManualSignature = () => { if (!manualSignature.trim()) return; const cleaned = manualSignature.trim(); if (signatures.includes(cleaned)) { toast.error('Already added'); return }; setSignatures(prev => [...prev, cleaned]); setManualSignature(''); toast.success('Signature added!') }

  const handleReconstruct = async () => { if (!walletAddress) return; setReconState('running'); setReconPhase('verifying'); setReconProg(0); try { const { jobId } = await nvApi.startReconstruct(asset.id, walletAddress, signatures) as { jobId: string }; const job = await pollJob(() => nvApi.pollReconstruct(jobId) as Promise<{ status: string; progress: number; downloadUrl?: string; error?: string }>, j => { setReconPhase(j.status); setReconProg(j.progress); setReconMsg(j.message as string || '') }) as { status: string; progress: number; downloadUrl?: string }; setDlUrl(job.downloadUrl || null); setReconState('done'); toast.success('File reconstructed — download ready') } catch (e) { setReconState('failed'); toast.error(`Failed: ${(e as Error).message}`) } }

  const handleDownload = () => { if (!dlUrl) return; window.location.href = dlUrl; toast.info(`Downloading "${asset.originalName}"`); setReconState('idle'); setReconPhase('idle'); setReconProg(0); setDlUrl(null) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0a0a0a', border: BDR, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 26px', borderBottom: BDR, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, background: RED_SOFT, border: BDR_R, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{fmt.icon(asset.mimeType)}</div>
            <div><div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: G[100] }}>{asset.title}</div><span className="m" style={{ fontSize: 9, color: G[400] }}>{fmt.mime(asset.mimeType)} · {fmt.bytes(asset.totalSize)}</span></div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: BDR, fontSize: 18, color: G[400], flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: 26 }}>
          <p className="b" style={{ fontSize: 14, color: G[300], lineHeight: 1.8, marginBottom: 26 }}>{asset.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 26 }}>
            {[['Price', fmt.usd(asset.priceUSD), asset.priceUSD ? GREEN : undefined], ['License', asset.licenseType, fmt.lc(asset.licenseType)], ['Creator', fmt.addr(asset.creatorWallet), undefined], ['Registered', fmt.date(asset.registeredAt), undefined], ['Downloads', String(asset.downloadCount), undefined], ['Royalties', fmt.usd(asset.royaltiesEarned), asset.royaltiesEarned ? GREEN : undefined]].map(([l, v, col]) => (
              <div key={l as string} style={{ background: 'rgba(255,255,255,.02)', border: BDR, padding: '14px 16px' }}>
                <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 6 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: (col as string) || G[100] }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, background: RED_SOFT, border: BDR_R, marginBottom: 26 }}>
            <div className="m" style={{ fontSize: 9, color: RED, marginBottom: 12 }}>NULLVAULT PROTECTION</div>
            {['Shamir SSS — N=10 fragments, K=6 threshold', `Location Map: CDR Vault (threshold-encrypted)`, `IP ID: ${fmt.addr(asset.ipId)}`, `Tx: ${fmt.hash(asset.txHash)}`].map(t => (<div key={t} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: G[400], marginBottom: 4 }}>→ {t}</div>))}
            {asset.isTeamIP && asset.teamSettings && (<><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: RED, marginTop: 8, fontWeight: 'bold' }}>→ 🔒 Team IP Multi-sig</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: RED }}>→ Threshold: {asset.teamSettings.threshold} of {asset.teamSettings.coSigners.length}</div></>)}
          </div>

          {!walletAddress && <div style={{ padding: 18, background: 'rgba(255,255,255,.02)', border: BDR, textAlign: 'center' }}><div className="b" style={{ fontSize: 14, color: G[400] }}>Connect a wallet to check or purchase a license</div></div>}
          {walletAddress && licState === 'checking' && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}><Spinner /><span className="m" style={{ fontSize: 10, color: G[400] }}>Checking license…</span></div>}
          {walletAddress && licState === 'none' && (<div><div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: RED_SOFT, border: BDR_R, marginBottom: 16 }}><span className="m" style={{ fontSize: 9, color: RED }}>NO LICENSE</span><span className="b" style={{ fontSize: 12, color: G[300] }}>Purchase to access this file.</span></div><Btn full size="lg" onClick={handlePurchase} disabled={buying}>{buying ? <><Spinner color="#fff" /> Processing…</> : `Purchase License — ${fmt.usd(asset.priceUSD)}`}</Btn></div>)}
          {walletAddress && licState === 'owned' && (<div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: `${GREEN}0d`, border: `1px solid ${GREEN}22`, marginBottom: 22 }}><span style={{ color: GREEN }}>✓</span><span className="m" style={{ fontSize: 9, color: GREEN }}>{isCreator ? 'CREATOR — FULL ACCESS' : 'LICENSE VERIFIED'}</span></div>

            {asset.isTeamIP && asset.teamSettings && reconState === 'idle' && !dlUrl && (
              <div style={{ padding: 18, background: 'rgba(255,255,255,.02)', border: BDR, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: BDR, paddingBottom: 10 }}><span className="m" style={{ fontSize: 9, color: G[100], fontWeight: 600 }}>MULTI-SIG REQUIRED</span><span style={{ fontSize: 12, color: RED, fontFamily: 'monospace' }}>{signatures.length} / {asset.teamSettings.threshold}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>{asset.teamSettings.coSigners.map((addr, idx) => (<div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'rgba(255,255,255,.01)', border: BDR }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: G[400] }}>{addr.slice(0, 10)}...{addr.slice(-8)}</span><span className="m" style={{ fontSize: 8, color: G[500] }}>#{idx + 1}</span></div>))}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Btn size="sm" onClick={handleSign} style={{ width: '100%' }}>✍️ Sign with Wallet</Btn><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="text" placeholder="Paste signature…" value={manualSignature} onChange={e => setManualSignature(e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,.03)', border: BDR, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace' }} /><Btn size="sm" onClick={handleAddManualSignature}>Add</Btn></div></div>
                {signatures.length > 0 && (<div style={{ borderTop: BDR, paddingTop: 12 }}><div className="m" style={{ fontSize: 8, color: G[500], marginBottom: 8 }}>SIGNATURES:</div>{signatures.map((sig, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.02)', border: BDR, padding: '6px 12px', marginBottom: 4 }}><span style={{ fontFamily: 'monospace', fontSize: 9, color: G[400], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{sig}</span><button onClick={() => setSignatures(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: RED, cursor: 'pointer', fontSize: 12 }}>×</button></div>))}</div>)}
              </div>
            )}

            {reconState === 'running' && (<div style={{ marginBottom: 22 }}><FragmentViz phase={reconPhase} progress={reconProg} /><div style={{ height: 2, background: 'rgba(255,255,255,.06)', margin: '16px 0 10px' }}><div style={{ height: '100%', background: RED, width: `${reconProg}%`, transition: 'width .4s' }} /></div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: G[400] }}>{reconMsg}</div></div>)}
            {reconState === 'failed' && <div style={{ padding: 14, background: RED_SOFT, border: BDR_R, marginBottom: 16 }}><div className="m" style={{ fontSize: 9, color: RED }}>RECONSTRUCTION FAILED</div></div>}
            {reconState === 'done' && dlUrl && (<div style={{ padding: 18, background: `${GREEN}0d`, border: `1px solid ${GREEN}22`, marginBottom: 16, textAlign: 'center' }}><div className="m" style={{ fontSize: 9, color: GREEN, marginBottom: 14 }}>RECONSTRUCTED ✓ — SINGLE-USE LINK</div><Btn variant="primary" full size="lg" onClick={handleDownload} style={{ background: GREEN, borderColor: GREEN }}>⬇ Download {asset.originalName}</Btn><div className="b" style={{ fontSize: 11, color: G[400], marginTop: 10 }}>Expires in 5 min · single use</div></div>)}
            {(reconState === 'idle' || reconState === 'failed') && (<Btn full size="lg" onClick={handleReconstruct} disabled={asset.isTeamIP && asset.teamSettings ? signatures.length < asset.teamSettings.threshold : false}>{asset.isTeamIP && asset.teamSettings && signatures.length < asset.teamSettings.threshold ? `🔓 ${signatures.length}/${asset.teamSettings.threshold} signed` : reconState === 'failed' ? '🔓 Retry' : '🔓 Reconstruct & Download'}</Btn>)}
          </div>)}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §19  HOME — HERO + PARALLAX + 3D + INFINITE FEEL
   ═══════════════════════════════════════════════════════════════════════ */
function Home({ setPage, assets }: { setPage: (p: string) => void; assets: Asset[] }) {
  const scrollY = useScrollY()
  const totalSize = assets.reduce((s, a) => s + a.totalSize, 0)

  const steps = [
    { n: '01', label: 'Upload any file', body: 'Images, audio, video, code, documents — any format up to 100MB.' },
    { n: '02', label: 'Shamir fragmentation', body: 'Your file splits into 10 mathematical shares. Any 6 reconstruct it. 5 or fewer = zero information.' },
    { n: '03', label: 'Distribute to nodes', body: 'Ghost fragments scatter across 10 independent storage nodes. No node knows what it holds.' },
    { n: '04', label: 'Register on Story Protocol', body: 'The fragment location map attaches to your IP asset via CDR. Access conditions go on-chain.' },
    { n: '05', label: 'License-gated delivery', body: 'When a buyer purchases a license, fragments assemble inside isolated hardware. Then dissolve.' },
  ]

  return (
    <div style={{ paddingTop: 70 }}>
      {/* ─── HERO ─── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Atmospheric gradients */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(255,26,26,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 75% 25%, rgba(255,26,26,.04) 0%, transparent 50%)', pointerEvents: 'none' }} />
        <div className="nv-dot-grid" style={{ position: 'absolute', inset: 0, opacity: .5 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,5,5,0) 0%, rgba(5,5,5,.7) 80%, #050505 100%)' }} />

        {/* Scan line */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: `linear-gradient(to right, transparent, ${RED}55, transparent)`, animation: 'nv-scan 10s linear infinite', pointerEvents: 'none' }} />

        {/* Parallax decorative rings */}
        <div style={{ position: 'absolute', top: '10%', right: '8%', width: 300, height: 300, border: '1px solid rgba(255,26,26,.08)', borderRadius: '50%', transform: `translateY(${scrollY * 0.12}px) rotate(${scrollY * 0.02}deg)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '15%', right: '12%', width: 200, height: 200, border: '1px solid rgba(255,255,255,.03)', borderRadius: '50%', transform: `translateY(${scrollY * 0.08}px) rotate(${-scrollY * 0.03}deg)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', left: '5%', width: 160, height: 160, border: '1px solid rgba(255,26,26,.06)', borderRadius: '50%', transform: `translateY(${scrollY * -0.05}px)`, pointerEvents: 'none', animation: 'nv-float 8s ease-in-out infinite' }} />

        <div style={{ position: 'relative', maxWidth: 1320, margin: '0 auto', width: '100%', padding: '0 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 80, alignItems: 'center' }}>
            {/* Left: Text content with parallax */}
            <div style={{ transform: `translateY(${scrollY * 0.15}px)` }}>
              {/* Protocol badge */}
              <div className="nv-fadein" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '7px 18px', background: RED_SOFT, border: BDR_R, marginBottom: 40 }}>
                <span className="nv-pulse" style={{ width: 6, height: 6, background: RED, display: 'block' }} />
                <span className="m" style={{ fontSize: 10, color: RED, letterSpacing: '0.18em' }}>NULLVAULT PROTOCOL · CDR v2.0</span>
              </div>

              {/* Main heading */}
              <h1 className="d" style={{ fontSize: 'clamp(56px, 8vw, 130px)', lineHeight: .88, marginBottom: 32, animation: 'nv-hero-in .8s ease-out both', animationDelay: '.1s' }}>
                Files that{' '}
                <span className="di" style={{ color: G[400] }}>do not</span>{' '}
                <span style={{ background: `linear-gradient(135deg, ${RED}, #ff4444)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>exist</span>
              </h1>

              {/* Tagline */}
              <p className="b" style={{ fontSize: 18, color: G[300], lineHeight: 1.8, maxWidth: 480, marginBottom: 48, animation: 'nv-fadein .7s ease-out both', animationDelay: '.3s' }}>
                Nothing is stored. Everything is preserved.<br />
                Data should not exist longer than the moment it is needed.
              </p>

              {/* CTA Buttons */}
              <div style={{ display: 'flex', gap: 16, animation: 'nv-fadein .7s ease-out both', animationDelay: '.45s' }}>
                <button onClick={() => setPage('vault')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 36px', background: RED, border: `1px solid ${RED}`, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .3s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${RED}44` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                  <span className="m" style={{ fontSize: 12, letterSpacing: '0.12em' }}>Go to My Vault</span>
                  <span style={{ fontSize: 18 }}>→</span>
                </button>
                <button onClick={() => setPage('explore')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 36px', background: 'transparent', border: BDR, color: G[300], fontSize: 14, cursor: 'pointer', transition: 'all .3s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,26,26,.3)'; e.currentTarget.style.color = G[100] }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = G[300] }}>
                  <span className="m" style={{ fontSize: 12, letterSpacing: '0.12em' }}>Explore IP</span>
                  <span style={{ fontSize: 14 }}>↗</span>
                </button>
              </div>
            </div>

            {/* Right: 3D Cube with parallax */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'nv-fadein 1s ease-out both', animationDelay: '.5s' }}>
              <div style={{ position: 'relative' }}>
                {/* Glow behind cube */}
                <div style={{ position: 'absolute', inset: -60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,26,26,.12) 0%, transparent 70%)', animation: 'nv-glow 4s ease-in-out infinite', pointerEvents: 'none' }} />
                <Cube3D size={200} scrollY={scrollY} />
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ marginTop: 100, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,.03)', overflow: 'hidden', transform: `translateY(${scrollY * 0.05}px)`, animation: 'nv-fadein .7s ease-out both', animationDelay: '.6s' }}>
            {[
              ['Threshold', 'K = 6', RED],
              ['Fragments', 'N = 10', G[100]],
              ['Assets Live', String(assets.length), assets.length > 0 ? GREEN : G[400]],
              ['Fragmented', fmt.bytes(totalSize), G[200]],
            ].map(([k, v, col]) => (
              <div key={k as string} style={{ padding: '28px 32px', background: '#050505', textAlign: 'center' }}>
                <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 12, letterSpacing: '0.15em' }}>{k}</div>
                <div className="d" style={{ fontSize: 30, color: col as string }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS — Parallax cards ─── */}
      <section style={{ padding: '140px 40px', maxWidth: 1320, margin: '0 auto', position: 'relative' }}>
        {/* Vertical timeline line */}
        <div style={{ position: 'absolute', left: 40, top: 0, bottom: 0, width: 1, background: `linear-gradient(to bottom, transparent, rgba(255,26,26,.1) 20%, rgba(255,26,26,.1) 80%, transparent)` }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 72, marginLeft: 40 }}>
          <span className="m" style={{ fontSize: 11, color: RED, letterSpacing: '0.2em' }}>HOW IT WORKS</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${RED}33, transparent)` }} />
        </div>

        <div style={{ display: 'grid', gap: 20, marginLeft: 40 }}>
          {steps.map((s, i) => (
            <Card3D key={i}>
              <div style={{ display: 'flex', gap: 28, padding: '32px 36px', background: 'rgba(255,255,255,.015)', border: BDR, transition: 'all .35s', position: 'relative' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,26,26,.15)'; e.currentTarget.style.background = 'rgba(255,26,26,.025)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)'; e.currentTarget.style.background = 'rgba(255,255,255,.015)' }}>
                {/* Step dot on timeline */}
                <div style={{ position: 'absolute', left: -48, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, background: RED, borderRadius: '50%', boxShadow: `0 0 12px ${RED}44` }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 52, height: 52, background: RED_SOFT, border: BDR_R, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="m" style={{ fontSize: 14, color: RED }}>{s.n}</span>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: G[100], marginBottom: 8 }}>{s.label}</h3>
                  <p className="b" style={{ fontSize: 14, color: G[400], lineHeight: 1.75 }}>{s.body}</p>
                </div>
              </div>
            </Card3D>
          ))}
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section style={{ padding: '0 40px 140px', maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ background: RED_SOFT, border: BDR_R, padding: '72px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 48, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
          {/* Corner accents */}
          <div style={{ position: 'absolute', top: -1, left: -1, width: 28, height: 28, borderTop: `2px solid ${RED}`, borderLeft: `2px solid ${RED}` }} />
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 28, height: 28, borderBottom: `2px solid ${RED}`, borderRight: `2px solid ${RED}` }} />

          <div>
            <div className="d" style={{ fontSize: 'clamp(24px, 3vw, 40px)', lineHeight: 1.2, marginBottom: 12, color: G[100] }}>
              Nothing is stored.<br />
              <span style={{ color: G[400] }}>Everything is preserved.</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setPage('vault')} style={{ padding: '16px 36px', background: RED, border: `1px solid ${RED}`, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .3s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${RED}33` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
              Upload & Register IP →
            </button>
            <button onClick={() => setPage('explore')} style={{ padding: '16px 36px', background: 'transparent', border: BDR, color: G[300], fontSize: 14, cursor: 'pointer', transition: 'all .25s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,26,26,.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)')}>
              Browse Assets
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §20  VAULT PAGE
   ═══════════════════════════════════════════════════════════════════════ */
function VaultPage({ walletAddress, allAssets, onAssetCreated }: { walletAddress: string | undefined; allAssets: Asset[]; onAssetCreated: (a: Asset) => void }) {
  const [tab, setTab] = useState('upload')
  const [myAssets, setMyAssets] = useState<Asset[]>([])
  const [myLoad, setMyLoad] = useState(false)
  const [licenses, setLicenses] = useState<License[]>([])
  const [licLoad, setLicLoad] = useState(false)
  const [step, setStep] = useState('drop')
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({ title: '', description: '', licenseType: 'commercial', priceUSD: '10', isTeamIP: false, coSigners: '', threshold: '2' })
  const [jobProg, setJobProg] = useState(0)
  const [jobPhase, setJobPhase] = useState('idle')
  const [jobMsg, setJobMsg] = useState('')
  const [doneAsset, setDoneAsset] = useState<Asset | null>(null)
  const [dragging, setDragging] = useState(false)
  const [selAsset, setSelAsset] = useState<Asset | null>(null)

  const loadMyAssets = useCallback(async () => { if (!walletAddress) return; setMyLoad(true); try { setMyAssets(await nvApi.getMyAssets(walletAddress) as Asset[]) } catch (e) { toast.error((e as Error).message) } finally { setMyLoad(false) } }, [walletAddress])
  const loadLicenses = useCallback(async () => { if (!walletAddress) return; setLicLoad(true); try { setLicenses(await nvApi.getMyLicenses(walletAddress) as License[]) } catch (e) { toast.error((e as Error).message) } finally { setLicLoad(false) } }, [walletAddress])
  useEffect(() => { if (tab === 'assets') loadMyAssets() }, [tab, loadMyAssets])
  useEffect(() => { if (tab === 'licenses') loadLicenses() }, [tab, loadLicenses])

  const resetUpload = () => { setFile(null); setForm({ title: '', description: '', licenseType: 'commercial', priceUSD: '10', isTeamIP: false, coSigners: '', threshold: '2' }); setStep('drop'); setJobProg(0); setJobPhase('idle'); setJobMsg(''); setDoneAsset(null) }
  const onFileDrop = useCallback((f: File) => { setFile(f); setForm(p => ({ ...p, title: f.name.replace(/\.[^.]+$/, '') })); setStep('meta') }, [])

  const runFragmentation = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (!form.description.trim()) { toast.error('Description required'); return }
    if (!walletAddress) { toast.error('Connect wallet first'); return }
    if (form.isTeamIP) { if (!form.coSigners.trim()) { toast.error('Co-signer wallets required'); return }; const count = form.coSigners.split(',').map(s => s.trim()).filter(Boolean).length; const tv = parseInt(form.threshold, 10); if (isNaN(tv) || tv < 1) { toast.error('Threshold must be at least 1'); return }; if (tv > count) { toast.error(`Threshold (${tv}) > co-signers (${count})`); return } }
    setStep('running'); setJobPhase('processing'); setJobProg(0)
    try {
      const fd = new FormData(); fd.append('file', file!); fd.append('title', form.title.trim()); fd.append('description', form.description.trim()); fd.append('licenseType', form.licenseType); fd.append('priceUSD', String(parseFloat(form.priceUSD) || 0)); fd.append('isTeamIP', String(form.isTeamIP))
      if (form.isTeamIP) { fd.append('coSigners', form.coSigners); fd.append('threshold', form.threshold) }
      const { jobId } = await nvApi.uploadFile(fd, walletAddress) as { jobId: string }
      const job = await pollJob(() => nvApi.pollUpload(jobId) as Promise<{ status: string; progress: number; message?: string; ipAsset?: Asset }>, j => { setJobPhase(j.status); setJobProg(j.progress); setJobMsg(j.message as string || '') }) as { status: string; progress: number; ipAsset?: Asset }
      setDoneAsset(job.ipAsset || null); setStep('done')
      if (job.ipAsset) { onAssetCreated(job.ipAsset); toast.success(`"${job.ipAsset.title}" registered!`) }
    } catch (e) { toast.error(`Upload failed: ${(e as Error).message}`); setStep('meta'); setJobPhase('idle') }
  }

  if (!walletAddress) return <div style={{ paddingTop: 90 }}><EmptyState icon="🔐" title="Connect your wallet" body="Use the Connect Wallet button above." /></div>

  const TABS = [{ key: 'upload', label: '⬆  Upload & Register' }, { key: 'assets', label: '🗂  My IP Assets' }, { key: 'licenses', label: '🔑  My Licenses' }]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '100px 40px 100px' }}>
      <div style={{ marginBottom: 36 }}>
        <h1 className="d" style={{ fontSize: 36, marginBottom: 8, color: G[100] }}>My Vault</h1>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: G[500] }}>{walletAddress}</div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: 4, background: 'rgba(255,255,255,.02)', border: BDR, marginBottom: 32 }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '12px 18px', background: tab === t.key ? RED : 'transparent', border: 'none', fontSize: 13, fontWeight: 500, color: tab === t.key ? '#fff' : G[400], transition: 'all .25s' }}>{t.label}</button>)}
      </div>

      {tab === 'upload' && (
        <div style={{ border: BDR, padding: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 className="d" style={{ fontSize: 24, color: G[100] }}>Register new IP asset</h2>
            <span className="m" style={{ fontSize: 9, color: G[500] }}>Story Aeneid + CDR</span>
          </div>
          {step === 'drop' && (
            <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) onFileDrop(e.dataTransfer.files[0]) }} onClick={() => document.getElementById('nv-file-inp')!.click()}
              style={{ border: `2px dashed ${dragging ? RED : 'rgba(255,255,255,.08)'}`, padding: '60px 32px', textAlign: 'center', cursor: 'pointer', background: dragging ? RED_SOFT : 'transparent', transition: 'all .3s' }}>
              <input id="nv-file-inp" type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) onFileDrop(e.target.files[0]) }} />
              <div style={{ fontSize: 44, opacity: .15, marginBottom: 18 }}>⬡</div>
              <div className="d" style={{ fontSize: 24, marginBottom: 10, color: G[100] }}>{dragging ? 'Drop to fragment' : 'Drop any file here'}</div>
              <div className="b" style={{ fontSize: 14, color: G[400] }}>Images · Audio · Video · Documents · Code · Up to 100 MB</div>
            </div>
          )}
          {step === 'meta' && file && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'rgba(255,255,255,.02)', border: BDR }}>
                <span style={{ fontSize: 24 }}>{fmt.icon(file.type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: G[100] }}>{file.name}</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: G[500], marginTop: 4 }}>{fmt.bytes(file.size)} · {file.type || 'unknown'}</div></div>
                <button onClick={resetUpload} className="m" style={{ fontSize: 9, color: G[400], border: BDR, padding: '5px 12px', background: 'transparent' }}>change</button>
              </div>
              {[{ key: 'title', label: 'TITLE *', ph: 'Name your IP asset', type: 'input' }, { key: 'description', label: 'DESCRIPTION *', ph: 'Describe what you\'re protecting…', type: 'textarea' }].map(f => (
                <div key={f.key}>
                  <div className="m" style={{ fontSize: 9, color: G[400], marginBottom: 8 }}>{f.label}</div>
                  {f.type === 'textarea' ? <textarea rows={3} value={form[f.key as keyof typeof form] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 14, resize: 'vertical', lineHeight: 1.7 }} />
                    : <input value={form[f.key as keyof typeof form] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 14 }} />}
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><div className="m" style={{ fontSize: 9, color: G[400], marginBottom: 8 }}>LICENSE TYPE</div><select value={form.licenseType} onChange={e => setForm(p => ({ ...p, licenseType: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 14 }}><option value="commercial">Commercial</option><option value="non-commercial">Non-commercial</option><option value="exclusive">Exclusive</option></select></div>
                <div><div className="m" style={{ fontSize: 9, color: G[400], marginBottom: 8 }}>PRICE (USD) — 0 = FREE</div><input type="number" min="0" value={form.priceUSD} onChange={e => setForm(p => ({ ...p, priceUSD: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 14 }} /></div>
              </div>

              {/* Team IP */}
              <div style={{ padding: 16, background: 'rgba(255,255,255,.015)', border: BDR, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div><span style={{ color: G[100], fontSize: 13, fontWeight: 500, display: 'block' }}>Team IP / Multi-Sig</span><span style={{ fontSize: 10, color: G[500], display: 'block', marginTop: 3 }}>Require co-signer approvals to download.</span></div>
                  <input type="checkbox" checked={form.isTeamIP} onChange={e => setForm(p => ({ ...p, isTeamIP: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: RED }} />
                </div>
                {form.isTeamIP && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: BDR, paddingTop: 14 }}>
                    <div><div className="m" style={{ fontSize: 9, color: G[400], marginBottom: 8 }}>CO-SIGNER WALLETS (COMMA-SEPARATED)</div><textarea value={form.coSigners} onChange={e => setForm(p => ({ ...p, coSigners: e.target.value }))} placeholder="0x123..., 0xabc..." rows={2} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 12, resize: 'none', fontFamily: 'monospace' }} /></div>
                    <div><div className="m" style={{ fontSize: 9, color: G[400], marginBottom: 8 }}>THRESHOLD (M OF N)</div><input type="number" min="1" value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,.03)', border: BDR, padding: '14px 16px', fontSize: 14 }} /></div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <Btn variant="secondary" onClick={resetUpload} style={{ flex: 1 }}>← Back</Btn>
                <Btn onClick={runFragmentation} style={{ flex: 2 }} disabled={!form.title.trim() || !form.description.trim()}>Fragment & Register IP →</Btn>
              </div>
            </div>
          )}
          {step === 'running' && (<div><FragmentViz phase={jobPhase} progress={jobProg} /><div style={{ marginTop: 18, height: 2, background: 'rgba(255,255,255,.06)' }}><div style={{ height: '100%', background: RED, width: `${jobProg}%`, transition: 'width .45s' }} /></div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}><Spinner /><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: G[400] }}>{jobMsg}</span></div></div>)}
          {step === 'done' && doneAsset && (<div><div style={{ textAlign: 'center', paddingBottom: 28 }}><div style={{ width: 64, height: 64, borderRadius: '50%', background: `${GREEN}12`, border: `2px solid ${GREEN}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 18px' }}>✓</div><div className="d" style={{ fontSize: 26, marginBottom: 10, color: G[100] }}>IP Asset Registered</div></div><div style={{ border: BDR, padding: '0 22px', marginBottom: 28 }}><InfoRow label="TITLE" value={doneAsset.title} /><InfoRow label="IP ID" value={fmt.hash(doneAsset.ipId)} mono /><InfoRow label="TX HASH" value={fmt.hash(doneAsset.txHash)} mono /><InfoRow label="FILE SIZE" value={fmt.bytes(doneAsset.totalSize)} /><InfoRow label="CDR VAULT" value={doneAsset.locationMapCid.slice(0, 28) + '…'} mono /></div><div style={{ display: 'flex', gap: 14 }}><Btn variant="secondary" onClick={resetUpload} style={{ flex: 1 }}>Upload another</Btn><Btn onClick={() => { loadMyAssets(); setTab('assets') }} style={{ flex: 1 }}>View Assets →</Btn></div></div>)}
        </div>
      )}

      {tab === 'assets' && (myLoad ? <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0', gap: 12, alignItems: 'center' }}><Spinner /><span className="m" style={{ fontSize: 10, color: G[400] }}>Loading…</span></div> : myAssets.length === 0 ? <EmptyState icon="🗂" title="No IP assets yet" body="Upload a file to register your first IP asset." action={<Btn onClick={() => setTab('upload')}>Upload & Register →</Btn>} /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>{myAssets.map(a => <AssetCard key={a.id} asset={a} onClick={() => setSelAsset(a)} showCreator={false} />)}</div>)}

      {tab === 'licenses' && (licLoad ? <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0', gap: 12, alignItems: 'center' }}><Spinner /><span className="m" style={{ fontSize: 10, color: G[400] }}>Loading…</span></div> : licenses.length === 0 ? <EmptyState icon="🔑" title="No licenses yet" body="Browse Explore IP and purchase a license." /> : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18, marginBottom: 28 }}>{licenses.map(l => { const a = allAssets.find(x => x.id === l.ipAssetId); return a ? <AssetCard key={l.id} asset={a} licensed onClick={() => setSelAsset(a)} /> : null })}</div>
          <div style={{ border: BDR, padding: 22 }}>
            <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 18 }}>LICENSE RECORDS</div>
            {licenses.map(l => { const a = allAssets.find(x => x.id === l.ipAssetId); return a ? (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: BDR }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ fontSize: 18 }}>{fmt.icon(a.mimeType)}</span><div><div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: G[100] }}>{a.title}</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: G[500] }}>{fmt.hash(l.txHash)} · {fmt.date(l.purchasedAt)}</div></div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 13, color: GREEN, fontWeight: 500 }}>{fmt.usd(l.pricePaid)}</span><Btn size="sm" onClick={() => setSelAsset(a)}>Reconstruct →</Btn></div>
              </div>
            ) : null })}
          </div>
        </div>
      ))}
      {selAsset && <AssetModal asset={selAsset} walletAddress={walletAddress} onClose={() => setSelAsset(null)} onLicensed={loadLicenses} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §21  EXPLORE PAGE
   ═══════════════════════════════════════════════════════════════════════ */
function ExplorePage({ walletAddress, allAssets, loading }: { walletAddress: string | undefined; allAssets: Asset[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selAsset, setSelAsset] = useState<Asset | null>(null)
  const [sessionLicensed, setSessionLicensed] = useState(new Set<string>())

  const FILTERS = [{ key: 'all', label: '🌐 All' }, { key: 'image', label: '🖼 Images' }, { key: 'audio', label: '🎵 Audio' }, { key: 'video', label: '🎬 Video' }, { key: 'document', label: '📄 Docs' }, { key: 'code', label: '💾 Code' }]
  const filtered = allAssets.filter(a => { const q = search.toLowerCase(); if (!a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false; if (filter === 'all') return true; return fmt.mf(a.mimeType) === filter })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 40px 100px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="d" style={{ fontSize: 36, marginBottom: 8, color: G[100] }}>Explore IP Assets</h1>
        <p className="b" style={{ color: G[400], fontSize: 15 }}>Browse and license protected intellectual property on Story Protocol</p>
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or description…" style={{ flex: 1, minWidth: 220, background: 'rgba(255,255,255,.03)', border: BDR, padding: '13px 18px', fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 2, padding: 4, background: 'rgba(255,255,255,.02)', border: BDR }}>
          {FILTERS.map(f => <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '8px 16px', background: filter === f.key ? RED : 'transparent', border: 'none', fontSize: 12, fontWeight: 500, color: filter === f.key ? '#fff' : G[400], whiteSpace: 'nowrap', transition: 'all .2s' }}>{f.label}</button>)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, fontSize: 12, color: G[500], flexWrap: 'wrap' }}>
        <span className="m" style={{ fontSize: 9 }}>{loading ? 'LOADING…' : `${filtered.length} ASSETS`}</span>
        {!loading && <><span>·</span><span>Value: {fmt.usd(filtered.reduce((s, a) => s + a.priceUSD, 0))}</span><span>·</span><span>{filtered.reduce((s, a) => s + a.downloadCount, 0).toLocaleString()} downloads</span></>}
        {!walletAddress && <><span>·</span><span style={{ color: AMBER }}>Connect wallet to purchase</span></>}
      </div>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '72px 0', gap: 12, alignItems: 'center' }}><Spinner size={20} /><span className="m" style={{ fontSize: 11, color: G[400] }}>Fetching…</span></div>
        : filtered.length === 0 ? <EmptyState icon="🔍" title={search ? 'No results' : 'No assets yet'} body={search ? `No assets match "${search}"` : 'Be the first to upload.'} />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>{filtered.map(a => <AssetCard key={a.id} asset={a} licensed={sessionLicensed.has(a.id)} onClick={() => setSelAsset(a)} />)}</div>}
      {selAsset && <AssetModal asset={selAsset} walletAddress={walletAddress} onLicensed={id => setSessionLicensed(p => new Set([...p, id]))} onClose={() => setSelAsset(null)} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §22  FOOTER — fades into the void
   ═══════════════════════════════════════════════════════════════════════ */
function Footer({ setPage }: { setPage: (p: string) => void }) {
  const go = (id: string) => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return (
    <footer style={{ borderTop: BDR, paddingTop: 80, paddingBottom: 60, position: 'relative', overflow: 'hidden' }}>
      {/* Fade-to-void gradient */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, transparent, #030303)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 64, marginBottom: 72 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span className="nv-pulse" style={{ width: 8, height: 8, background: RED, display: 'block' }} />
              <span className="m" style={{ fontSize: 12, letterSpacing: '0.3em', color: G[100] }}>NULLVAULT</span>
            </div>
            <p className="b" style={{ fontSize: 14, color: G[500], lineHeight: 1.8, maxWidth: 320 }}>
              Nothing is stored. Everything is preserved. Data should not exist longer than the moment it is needed.
            </p>
          </div>
          <div>
            <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 18 }}>NAVIGATE</div>
            {[['Home', 'home'], ['My Vault', 'vault'], ['Explore IP', 'explore']].map(([l, id]) => <button key={id} onClick={() => go(id)} style={{ display: 'block', fontSize: 13, color: G[400], background: 'none', border: 'none', marginBottom: 12, textAlign: 'left', transition: 'color .2s' }} onMouseEnter={e => (e.currentTarget.style.color = RED)} onMouseLeave={e => (e.currentTarget.style.color = G[400])}>{l}</button>)}
          </div>
          <div>
            <div className="m" style={{ fontSize: 9, color: G[500], marginBottom: 18 }}>STACK</div>
            {['@piplabs/cdr-sdk', 'Story Protocol', 'Pinata IPFS', 'Shamir SSS', 'wagmi + RainbowKit'].map(t => <div key={t} className="b" style={{ fontSize: 13, color: G[500], marginBottom: 10 }}>{t}</div>)}
          </div>
        </div>

        {/* Large watermark text */}
        <div style={{ borderTop: BDR, paddingTop: 48, position: 'relative' }}>
          <div className="d" style={{ fontSize: 'clamp(60px, 14vw, 180px)', lineHeight: .9, color: 'rgba(255,255,255,.02)', userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.05em' }}>NULLVAULT</div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="m" style={{ fontSize: 9, color: G[600] }}>© 2025 NULLVAULT</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="nv-pulse" style={{ width: 5, height: 5, background: RED, display: 'inline-block' }} /><span className="m" style={{ fontSize: 9, color: RED }}>SYSTEM NOMINAL</span></div>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   §23  APP ROOT — LENIS + PARTICLES + INFINITE LINE
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  useFonts()
  useSmoothScroll()
  const { address, isConnected } = useAccount()
  const [page, setPage] = useState('home')
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [assetsLoad, setAssetsLoad] = useState(true)
  const [backendOk, setBackendOk] = useState(true)

  useEffect(() => { nvApi.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false)) }, [])
  const loadAllAssets = useCallback(async () => { setAssetsLoad(true); try { setAllAssets(await nvApi.getAllAssets() as Asset[]) } catch { } finally { setAssetsLoad(false) } }, [])
  useEffect(() => { loadAllAssets() }, [loadAllAssets])

  const navigate = (id: string) => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const walletAddress = isConnected ? address : undefined

  return (
    <div id="nv-root">
      {/* Ambient layers */}
      <ParticleField />
      <InfinityLine />

      {/* Dot grid background for entire page */}
      <div className="nv-dot-grid" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: .3 }} />

      <ToastContainer />
      <Nav page={page} setPage={navigate} />
      {!backendOk && <div style={{ marginTop: 70 }}><OfflineBanner /></div>}
      <StatsTicker assets={allAssets} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {page === 'home' && <Home setPage={navigate} assets={allAssets} />}
        {page === 'vault' && <VaultPage walletAddress={walletAddress} allAssets={allAssets} onAssetCreated={a => setAllAssets(p => [a, ...p])} />}
        {page === 'explore' && <ExplorePage walletAddress={walletAddress} allAssets={allAssets} loading={assetsLoad} />}
        <Footer setPage={navigate} />
      </div>
    </div>
  )
}
