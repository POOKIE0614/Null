import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, DEMO_WALLETS } from '../../store/store'
import { fmt, clsx } from '../../utils/helpers'

export function Navbar() {
  const { wallet, setWallet } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  const links = [
    { to: '/', label: 'Home' },
    { to: '/vault', label: 'My Vault' },
    { to: '/explore', label: 'Explore IP' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void/80 backdrop-blur-md border-b border-void-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-void-500 flex items-center justify-center text-white text-sm font-bold">N</div>
          <span className="font-semibold text-white text-sm">NullVault</span>
          <span className="hidden sm:inline-block text-xs px-1.5 py-0.5 rounded bg-void-100 text-void-600 border border-void-200">CDR × Story</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.to} to={l.to} className={clsx(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              loc.pathname === l.to ? 'text-white bg-void-200' : 'text-void-600 hover:text-white hover:bg-void-100'
            )}>{l.label}</Link>
          ))}
        </div>

        {/* Wallet */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all',
              wallet
                ? 'bg-void-100 border-void-300 text-white hover:border-void-500'
                : 'bg-void-500 border-void-400 text-white hover:bg-void-600'
            )}
          >
            <span className={clsx('w-2 h-2 rounded-full', wallet ? 'bg-neon-green animate-pulse' : 'bg-void-400')} />
            {wallet ? (
              <span className="font-mono">{fmt.addr(wallet.address)}</span>
            ) : (
              <span>Connect Wallet</span>
            )}
            <span className="text-void-500">▾</span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-72 bg-void-50 border border-void-200 rounded-xl p-2 shadow-2xl"
              >
                <p className="text-xs text-void-500 px-2 py-1.5 font-medium">Demo wallets</p>
                {DEMO_WALLETS.map(w => (
                  <button
                    key={w.address}
                    onClick={() => { setWallet(w); setOpen(false) }}
                    className={clsx(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      wallet?.address === w.address ? 'bg-void-200 border border-void-400' : 'hover:bg-void-100'
                    )}
                  >
                    <span className="text-lg">{w.role === 'creator' ? '🎨' : '🛒'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{w.label}</span>
                        {wallet?.address === w.address && <span className="text-xs text-neon-green">active</span>}
                      </div>
                      <span className="font-mono text-xs text-void-500">{fmt.addr(w.address)}</span>
                      <div className="text-xs text-void-500 mt-0.5">{fmt.usd(w.balance)} balance</div>
                    </div>
                  </button>
                ))}
                {wallet && (
                  <button onClick={() => { setWallet(null); setOpen(false) }}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-neon-red hover:bg-red-950/40 transition-colors text-left">
                    Disconnect
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex border-t border-void-200 px-4">
        {links.map(l => (
          <Link key={l.to} to={l.to} className={clsx(
            'flex-1 py-2 text-center text-xs transition-colors',
            loc.pathname === l.to ? 'text-void-700' : 'text-void-500 hover:text-void-700'
          )}>{l.label}</Link>
        ))}
      </div>
    </nav>
  )
}
