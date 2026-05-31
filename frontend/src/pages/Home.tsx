import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/store'
import { apiService } from '../services/api'
import { Btn, Card } from '../components/UI';
import { GlassCard } from '../components/GlassCard';
import { ParallaxWrapper } from '../components/ParallaxWrapper';

const fade = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.1 } } }

export default function Home() {
  const navigate = useNavigate()
  const { wallet } = useStore()
  const [healthy, setHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    apiService.health()
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false))
  }, [])

  const steps = [
    { icon: '⬆', label: 'Upload any file', body: 'Images, audio, video, code, documents — any format up to 100MB.' },
    { icon: '⬡', label: 'Shamir fragmentation', body: 'Your file is split into 10 mathematical shares. Any 6 reconstruct it. 5 or fewer = zero information. Not encryption — mathematical impossibility.' },
    { icon: '🌐', label: 'Distribute to nodes', body: 'Ghost fragments scatter across 10 independent storage nodes. No node knows what it holds, who owns it, or that other nodes exist.' },
    { icon: '📜', label: 'Register on Story Protocol', body: 'The fragment location map attaches to your IP asset via CDR. Access conditions go on-chain. Your file does not exist anywhere.' },
    { icon: '🔓', label: 'License-gated delivery', body: 'When a buyer purchases a license, the smart contract releases the map to a TEE. Fragments assemble inside isolated hardware. File materialises — then dissolves.' },
  ]

  const stats = [
    { label: 'Shamir N', value: '10', sub: 'fragments per chunk' },
    { label: 'Threshold K', value: '6', sub: 'needed to reconstruct' },
    { label: 'Redundancy', value: '167%', sub: 'fault tolerant' },
    { label: 'Information leaked', value: '0', sub: 'below threshold' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

      {/* Hero */}
      <ParallaxWrapper speed={-2} className="text-center mb-16">
        <GlassCard className="p-8 bg-void-50 border border-void-200">
          <motion.div variants={fade} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-void-100 border border-void-200 text-xs text-void-600 mb-6">
            <span className={`w-1.5 h-1.5 rounded-full ${healthy ? 'bg-neon-green animate-pulse' : healthy === false ? 'bg-neon-red' : 'bg-void-400'}`} />
            {healthy ? 'Backend live · Story Aeneid testnet (mock)' : healthy === false ? 'Backend offline — start the server' : 'Connecting...'}
          </motion.div>

          <motion.h1 variants={fade} className="text-4xl sm:text-5xl font-light text-white mb-4 leading-tight">
            Your IP exists only<br />
            <span className="text-void-700">when you need it.</span>
          </motion.h1>

          <motion.p variants={fade} className="text-void-500 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            NullVault combines Shamir's Secret Sharing with Story Protocol's CDR
            to create IP that is mathematically impossible to steal — because it doesn't exist.
          </motion.p>

          <motion.div variants={fade} className="flex flex-wrap gap-3 justify-center">
            <Btn onClick={() => navigate(wallet ? '/vault' : '/')} className="px-6 py-3 text-base">
              {wallet ? 'Go to My Vault →' : 'Connect wallet to start'}
            </Btn>
            <Btn variant="secondary" onClick={() => navigate('/explore')} className="px-6 py-3 text-base">
              Explore IP Assets
            </Btn>
          </motion.div>
        </GlassCard>
      </ParallaxWrapper>

      {/* Stats bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-16">
        {stats.map(s => (
          <div key={s.label} className="bg-void-100 border border-void-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-light text-void-700 mb-0.5">{s.value}</p>
            <p className="text-xs font-medium text-void-600 mb-0.5">{s.label}</p>
            <p className="text-xs text-void-400">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-void-500">How it works</h2>
          <div className="flex-1 h-px bg-void-200" />
        </div>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
              className="flex gap-4 p-4 bg-void-50 border border-void-200 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-void-100 border border-void-200 flex items-center justify-center text-lg flex-shrink-0">{s.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-void-500">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-white text-sm font-medium">{s.label}</h3>
                </div>
                <p className="text-void-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Bottom CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        className="mt-12 text-center p-8 bg-void-50 border border-void-200 rounded-2xl">
        <p className="text-void-500 text-sm mb-1">Built for the Story Protocol CDR Buildathon</p>
        <p className="text-white font-medium mb-4">Nothing is stored. Everything is preserved.</p>
        <div className="flex flex-wrap gap-2 justify-center text-xs">
          {['Shamir\'s Secret Sharing', 'Story Protocol CDR', 'TEE reconstruction', 'Quantum resistant', 'Zero storage attack surface'].map(t => (
            <span key={t} className="px-2 py-1 rounded-md bg-void-100 border border-void-200 text-void-600">{t}</span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
