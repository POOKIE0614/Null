import { useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { IPAsset } from '../../types'
import { fmt } from '../../utils/helpers'

export function StatsTicker() {
  const [assets, setAssets] = useState<IPAsset[]>([])

  useEffect(() => {
    apiService.getAllAssets().then(setAssets).catch(() => {})
    const t = setInterval(() => {
      apiService.getAllAssets().then(setAssets).catch(() => {})
    }, 15000)
    return () => clearInterval(t)
  }, [])

  if (assets.length === 0) return null

  const totalValue = assets.reduce((s, a) => s + a.priceUSD, 0)
  const totalSize  = assets.reduce((s, a) => s + a.totalSize, 0)

  const items = [
    `${assets.length} IP assets protected`,
    `${fmt.usd(totalValue)} total value`,
    `${fmt.bytes(totalSize)} of data fragmented`,
    `${assets.reduce((s,a)=>s+a.downloadCount,0)} downloads`,
    'Shamir N=10 K=6',
    'Story Protocol CDR',
  ]

  return (
    <div className="bg-void-100 border-b border-void-200 overflow-hidden py-1">
      <div className="flex animate-[ticker_20s_linear_infinite] whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-xs text-void-500 px-6 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-void-400 inline-block" />
            {item}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
