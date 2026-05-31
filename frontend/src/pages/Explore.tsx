import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apiService } from '../services/api'
import { IPAsset } from '../types'
import { AssetCard } from '../components/Vault/AssetCard'
import { AssetModal } from '../components/Vault/AssetModal'
import { SectionHead, Empty } from '../components/UI'
import { fmt } from '../utils/helpers'

type Filter = 'all' | 'image' | 'audio' | 'video' | 'document' | 'code'

export default function Explore() {
  const [assets, setAssets] = useState<IPAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<IPAsset | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiService.getAllAssets()
      .then(setAssets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filterFn = (a: IPAsset): boolean => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'all') return true
    if (filter === 'image') return a.mimeType.startsWith('image/')
    if (filter === 'audio') return a.mimeType.startsWith('audio/')
    if (filter === 'video') return a.mimeType.startsWith('video/')
    if (filter === 'document') return a.mimeType.includes('pdf') || a.mimeType.startsWith('text/')
    if (filter === 'code') return a.mimeType.includes('javascript') || a.mimeType.includes('octet') || a.originalName?.match(/\.(sol|py|ts|js|rs)$/) != null
    return true
  }

  const filtered = assets.filter(filterFn)

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: '🌐 All' },
    { key: 'image', label: '🖼 Images' },
    { key: 'audio', label: '🎵 Audio' },
    { key: 'video', label: '🎬 Video' },
    { key: 'document', label: '📄 Docs' },
    { key: 'code', label: '💾 Code' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 pt-16 pb-16">
      <div className="pt-4 mb-6">
        <h1 className="text-white font-semibold text-xl mb-1">Explore IP Assets</h1>
        <p className="text-void-500 text-sm">Browse and license protected intellectual property on Story Protocol</p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or description..."
          className="flex-1 bg-void-100 border border-void-200 rounded-xl px-4 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:border-void-500 transition-colors"
        />
        <div className="flex gap-1 p-1 bg-void-100 rounded-xl border border-void-200 overflow-x-auto">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${filter === f.key ? 'bg-void-500 text-white' : 'text-void-500 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="flex items-center gap-4 mb-4 text-xs text-void-500">
          <span>{filtered.length} assets</span>
          <span>·</span>
          <span>Total value: {fmt.usd(filtered.reduce((s, a) => s + a.priceUSD, 0))}</span>
          <span>·</span>
          <span>{filtered.reduce((s, a) => s + a.downloadCount, 0)} total downloads</span>
        </div>
      )}

      <SectionHead label="Protected IP assets" icon="🔐" />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-void-500 text-sm gap-2">
          <span className="animate-spin text-void-600">⟳</span> Loading assets...
        </div>
      ) : filtered.length === 0 ? (
        <Empty icon="🔍" title="No assets found" body={search ? `No results for "${search}"` : 'No IP assets registered yet — be the first to upload one'} />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <AssetCard asset={a} onClick={() => setSelected(a)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {selected && <AssetModal asset={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
