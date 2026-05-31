import { motion } from 'framer-motion'
import { IPAsset } from '../../types'
import { Badge, MonoAddr } from '../UI'
import { fmt } from '../../utils/helpers'

interface Props {
  asset: IPAsset
  onClick: () => void
  showCreator?: boolean
}

export function AssetCard({ asset, onClick, showCreator = true }: Props) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 0 24px rgba(127,119,221,0.15)' }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="bg-void-50 border border-void-200 rounded-xl p-5 cursor-pointer transition-colors hover:border-void-400 group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-void-100 border border-void-200 flex items-center justify-center text-xl flex-shrink-0">
            {fmt.mimeIcon(asset.mimeType)}
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium text-sm truncate group-hover:text-void-700 transition-colors">
              {asset.title}
            </h3>
            <p className="text-void-500 text-xs mt-0.5">{fmt.mime(asset.mimeType)}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-neon-green font-semibold text-sm">{fmt.usd(asset.priceUSD)}</p>
          <Badge variant="purple" >{asset.licenseType}</Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-void-500 text-xs leading-relaxed line-clamp-2 mb-3">
        {asset.description}
      </p>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs border-t border-void-100 pt-3">
        <div className="flex items-center gap-3">
          <span className="text-void-500">
            <span className="text-void-600 font-medium">{asset.downloadCount}</span> downloads
          </span>
          <span className="text-void-400">·</span>
          <span className="text-void-500">{fmt.bytes(asset.totalSize)}</span>
        </div>
        {showCreator && <MonoAddr addr={asset.creatorWallet} />}
      </div>

      {/* CDR badge */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-void-500 animate-pulse" />
        <span className="text-xs text-void-500 font-mono">CDR protected · Story Protocol</span>
      </div>
    </motion.div>
  )
}
