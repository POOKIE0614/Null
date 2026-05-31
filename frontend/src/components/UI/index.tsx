import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { clsx } from '../../utils/helpers'

// ── Badge ────────────────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; variant?: 'purple'|'green'|'amber'|'red'|'gray'|'blue' }
export function Badge({ children, variant = 'purple' }: BadgeProps) {
  const cls = {
    purple: 'bg-void-200 text-void-700 border-void-400',
    green: 'bg-green-950 text-neon-green border-neon-green-dim',
    amber: 'bg-amber-950 text-neon-amber border-yellow-700',
    red: 'bg-red-950 text-neon-red border-red-800',
    gray: 'bg-void-100 text-void-600 border-void-300',
    blue: 'bg-blue-950 text-neon-blue border-blue-800',
  }[variant]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{children}</span>
}

// ── Progress bar ────────────────────────────────────────────────────
interface ProgressProps { value: number; label?: string; color?: string }
export function ProgressBar({ value, label, color = 'bg-void-600' }: ProgressProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        {label && <span className="text-xs text-void-600">{label}</span>}
        <span className="text-xs font-mono text-void-500 ml-auto">{value}%</span>
      </div>
      <div className="h-1.5 bg-void-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────
interface CardProps { children: ReactNode; className?: string; glow?: boolean; onClick?: () => void }
export function Card({ children, className, glow, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-void-50 border border-void-200 rounded-xl p-5',
        glow && 'shadow-[0_0_20px_rgba(127,119,221,0.15)]',
        onClick && 'cursor-pointer hover:border-void-500 transition-colors duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────
interface BtnProps { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary'|'secondary'|'danger'|'ghost'; className?: string; type?: 'button'|'submit' }
export function Btn({ children, onClick, disabled, variant = 'primary', className, type = 'button' }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed'
  const cls = {
    primary: 'bg-void-500 hover:bg-void-600 text-white border border-void-400',
    secondary: 'bg-void-100 hover:bg-void-200 text-void-700 border border-void-300',
    danger: 'bg-red-900/40 hover:bg-red-900/70 text-neon-red border border-red-800',
    ghost: 'text-void-600 hover:text-void-700 hover:bg-void-100 border border-transparent',
  }[variant]
  return <button type={type} onClick={onClick} disabled={disabled} className={clsx(base, cls, className)}>{children}</button>
}

// ── Status dot ────────────────────────────────────────────────────────
export function StatusDot({ status }: { status: string }) {
  const isGood = ['complete', 'verifying', 'fetching', 'assembling', 'processing', 'distributing', 'registering'].includes(status)
  const isFail = status === 'failed'
  return (
    <span className={clsx(
      'inline-block w-2 h-2 rounded-full',
      isFail ? 'bg-neon-red' : isGood ? 'bg-neon-green animate-pulse' : 'bg-void-400'
    )}/>
  )
}

// ── Mono address ──────────────────────────────────────────────────────
export function MonoAddr({ addr, className }: { addr: string; className?: string }) {
  return <span className={clsx('font-mono text-xs text-void-500', className)}>{addr.slice(0,8)}...{addr.slice(-6)}</span>
}

// ── Section heading ───────────────────────────────────────────────────
export function SectionHead({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {icon && <span>{icon}</span>}
      <h2 className="text-xs font-semibold tracking-widest uppercase text-void-500">{label}</h2>
      <div className="flex-1 h-px bg-void-200"/>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────
export function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4 opacity-40">{icon}</div>
      <p className="text-void-600 font-medium mb-1">{title}</p>
      <p className="text-void-400 text-sm">{body}</p>
    </div>
  )
}
