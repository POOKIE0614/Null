import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { apiService } from '../services/api'
import { IPAsset } from '../types'
import { UploadPanel } from '../components/Upload/UploadPanel'
import { AssetCard } from '../components/Vault/AssetCard'
import { AssetModal } from '../components/Vault/AssetModal'
import { Card, SectionHead, Empty, Badge } from '../components/UI'
import { fmt } from '../utils/helpers'

export default function VaultPage() {
  const { wallet, refreshTrigger } = useStore()
  const navigate = useNavigate()
  const [myAssets, setMyAssets] = useState<IPAsset[]>([])
  const [selected, setSelected] = useState<IPAsset | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'upload' | 'assets'>('upload')

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    apiService.getMyAssets()
      .then(setMyAssets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [wallet, refreshTrigger])

  if (!wallet) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-30">🔐</div>
          <p className="text-white font-medium text-lg mb-2">Connect your wallet</p>
          <p className="text-void-500 text-sm">Use the wallet selector in the top right to connect a demo wallet</p>
        </div>
      </div>
    )
  }

  const totalRoyalties = myAssets.reduce((s, a) => s + a.royaltiesEarned, 0)
  const totalDownloads = myAssets.reduce((s, a) => s + a.downloadCount, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 pt-16 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-4">
        <div>
          <h1 className="text-white font-semibold text-xl">My Vault</h1>
          <p className="text-void-500 text-sm mt-0.5 font-mono">{fmt.addr(wallet.address)}</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: `${myAssets.length} assets`, variant: 'purple' as const },
            { label: `${fmt.usd(totalRoyalties)} earned`, variant: 'green' as const },
            { label: `${totalDownloads} downloads`, variant: 'gray' as const },
          ].map(b => <Badge key={b.label} variant={b.variant}>{b.label}</Badge>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-void-100 rounded-xl border border-void-200 mb-6">
        {[
          { key: 'upload', label: '⬆ Upload & Register' },
          { key: 'assets', label: `🗂 My IP Assets (${myAssets.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-void-500 text-white' : 'text-void-500 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === 'upload' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card glow>
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-white font-medium">Register new IP asset</h2>
              <div className="flex-1 h-px bg-void-200" />
              <span className="text-xs text-void-500">Story Aeneid (mock)</span>
            </div>
            <UploadPanel onSuccess={(asset) => {
              setMyAssets(prev => [asset, ...prev])
              setTab('assets')
            }} />
          </Card>
        </motion.div>
      )}

      {/* Assets tab */}
      {tab === 'assets' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SectionHead label="Your registered IP assets" icon="🔐" />
          {loading ? (
            <div className="flex items-center justify-center py-12 text-void-500 text-sm gap-2">
              <span className="animate-spin">⟳</span> Loading...
            </div>
          ) : myAssets.length === 0 ? (
            <Empty icon="🗂" title="No IP assets yet" body="Upload a file to register your first IP asset on Story Protocol" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {myAssets.map(a => (
                <AssetCard key={a.id} asset={a} onClick={() => setSelected(a)} showCreator={false} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {selected && <AssetModal asset={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
