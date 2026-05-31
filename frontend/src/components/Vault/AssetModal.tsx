import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { IPAsset, ReconstructJob } from '../../types'
import { apiService, pollUntilDone } from '../../services/api'
import { useStore } from '../../store/store'
import { FragmentViz } from '../UI/FragmentViz'
import { ProgressBar, Badge, Btn, MonoAddr } from '../UI'
import { fmt } from '../../utils/helpers'

interface Props { asset: IPAsset; onClose: () => void }

type AccessState = 'checking' | 'none' | 'licensed' | 'creator'
type ReconPhase = 'idle' | 'verifying' | 'fetching' | 'assembling' | 'complete'

function toVizPhase(status: ReconstructJob['status']): ReconPhase {
  if (status === 'verifying') return 'verifying'
  if (status === 'fetching') return 'fetching'
  if (status === 'assembling') return 'assembling'
  if (status === 'complete') return 'complete'
  return 'idle'
}

export function AssetModal({ asset, onClose }: Props) {
  const { wallet, triggerRefresh } = useStore()
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [reconJob, setReconJob] = useState<ReconstructJob | null>(null)
  const [reconPhase, setReconPhase] = useState<ReconPhase>('idle')
  const [buying, setBuying] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [signatures, setSignatures] = useState<string[]>([])
  const [manualSignature, setManualSignature] = useState('')

  // Check license on mount
  useEffect(() => {
    if (!wallet) { setAccessState('none'); return }
    apiService.checkLicense(asset.id).then(({ hasLicense, isCreator }) => {
      if (isCreator) setAccessState('creator')
      else if (hasLicense) setAccessState('licensed')
      else setAccessState('none')
    }).catch(() => setAccessState('none'))
  }, [asset.id, wallet])

  const handlePurchase = async () => {
    if (!wallet) { toast.error('Connect a wallet first'); return }
    setBuying(true)
    try {
      await apiService.purchaseLicense(asset.id)
      toast.success('License purchased! You can now access this file.')
      setAccessState('licensed')
      triggerRefresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally { setBuying(false) }
  }

  const handleSign = async () => {
    try {
      const provider = (window as any).ethereum
      if (!provider) {
        toast.error('No Ethereum provider found. Please use a web3 browser.')
        return
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      const account = accounts[0]
      
      const message = `NullVault: Reconstruct asset ${asset.id}`
      const toHex = (str: string) => '0x' + Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('')
      const hexMessage = toHex(message)
      
      const signature = await provider.request({
        method: 'personal_sign',
        params: [hexMessage, account]
      })
      
      if (signature) {
        if (signatures.includes(signature)) {
          toast.error('Signature already added')
          return
        }
        setSignatures(prev => [...prev, signature])
        toast.success('Successfully signed reconstruction request!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Signing failed')
    }
  }

  const handleAddManualSignature = () => {
    if (!manualSignature.trim()) return
    const cleaned = manualSignature.trim()
    if (signatures.includes(cleaned)) {
      toast.error('Signature already added')
      return
    }
    setSignatures(prev => [...prev, cleaned])
    setManualSignature('')
    toast.success('Signature added manually!')
  }

  const handleReconstruct = async () => {
    if (!wallet) return
    setReconPhase('verifying')
    setDownloadUrl(null)
    try {
      const { jobId } = await apiService.startReconstruct(asset.id, signatures)
      const done = await pollUntilDone(
        () => apiService.pollReconstructJob(jobId),
        (j) => { setReconJob({ ...j }); setReconPhase(toVizPhase(j.status) as ReconPhase) },
        700
      ) as ReconstructJob
      if (done.downloadUrl) setDownloadUrl(done.downloadUrl)
    } catch (err) {
      toast.error((err as Error).message)
      setReconPhase('idle')
    }
  }

  const handleDownload = () => {
    if (!downloadUrl) return
    window.open(downloadUrl, '_blank')
    toast('Download started — link is single-use and expires in 5 minutes', { icon: '🔐' })
    setDownloadUrl(null)
    setReconPhase('idle')
    setReconJob(null)
  }

  const canAccess = accessState === 'licensed' || accessState === 'creator'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-void-50 border border-void-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-void-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-void-100 border border-void-200 flex items-center justify-center text-2xl">
                {fmt.mimeIcon(asset.mimeType)}
              </div>
              <div>
                <h2 className="text-white font-semibold">{asset.title}</h2>
                <p className="text-void-500 text-xs mt-0.5">{fmt.mime(asset.mimeType)} · {fmt.bytes(asset.totalSize)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-void-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-void-100 transition-colors text-lg">×</button>
          </div>

          <div className="p-5 space-y-5">
            {/* Description */}
            <p className="text-void-500 text-sm leading-relaxed">{asset.description}</p>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Price', value: fmt.usd(asset.priceUSD), highlight: true },
                { label: 'License', value: asset.licenseType },
                { label: 'Creator', value: fmt.addr(asset.creatorWallet) },
                { label: 'Registered', value: fmt.date(asset.registeredAt) },
                { label: 'Downloads', value: String(asset.downloadCount) },
                { label: 'Royalties', value: fmt.usd(asset.royaltiesEarned) },
              ].map(m => (
                <div key={m.label} className="bg-void-100 rounded-lg p-3 border border-void-200">
                  <p className="text-void-500 text-xs mb-0.5">{m.label}</p>
                  <p className={`text-sm font-medium ${m.highlight ? 'text-neon-green' : 'text-white'}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* CDR info */}
            <div className="p-3 bg-void-100 rounded-lg border border-void-200 space-y-1.5 text-xs text-void-500">
              <p className="font-medium text-void-600">NullVault protection</p>
              <p>→ Shamir N=10 K=6 fragments across 10 nodes</p>
              <p className="font-mono break-all">→ Map CID: {asset.locationMapCid.slice(0, 32)}...</p>
              <p className="font-mono break-all">→ IP ID: {fmt.addr(asset.ipId)}</p>
              <p className="font-mono break-all">→ Tx: {fmt.hash(asset.txHash)}</p>
              {asset.isTeamIP && asset.teamSettings && (
                <>
                  <p className="text-neon-cyan font-semibold">🔒 Team IP Multi-sig Enabled</p>
                  <p className="font-mono text-neon-cyan">→ Threshold: {asset.teamSettings.threshold} of {asset.teamSettings.coSigners.length}</p>
                </>
              )}
            </div>

            {/* Access state */}
            {accessState === 'checking' && (
              <div className="flex items-center gap-2 text-void-500 text-sm py-2">
                <span className="animate-spin">⟳</span> Checking license...
              </div>
            )}

            {/* No access */}
            {!canAccess && accessState !== 'checking' && !wallet && (
              <div className="p-4 bg-void-100 rounded-xl border border-void-200 text-center">
                <p className="text-void-500 text-sm">Connect a wallet to purchase a license</p>
              </div>
            )}

            {!canAccess && accessState === 'none' && wallet && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-950/30 border border-yellow-800/50 rounded-lg text-xs text-neon-amber">
                  You don't hold a license for this asset. Purchase one to access the file.
                </div>
                <Btn onClick={handlePurchase} disabled={buying} className="w-full">
                  {buying ? '⟳ Processing...' : `Purchase License — ${fmt.usd(asset.priceUSD)}`}
                </Btn>
              </div>
            )}

            {/* Has access */}
            {canAccess && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-neon-green p-2 bg-green-950/30 border border-neon-green-dim/30 rounded-lg">
                  <span>✓</span>
                  <span>{accessState === 'creator' ? 'You are the creator — full access' : 'License verified — you can access this file'}</span>
                </div>

                {/* Team IP / Multi-sig Status */}
                {asset.isTeamIP && asset.teamSettings && reconPhase === 'idle' && !downloadUrl && (
                  <div className="p-4 bg-void-100 rounded-xl border border-void-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-void-200/50 pb-2">
                      <span className="text-white text-xs font-semibold uppercase tracking-wider block">Multi-Sig Reconstruction Required</span>
                      <span className="text-neon-cyan text-xs font-mono">{signatures.length} / {asset.teamSettings.threshold} Signed</span>
                    </div>
                    
                    {/* List of co-signers */}
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {asset.teamSettings.coSigners.map((addr, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-1 bg-void-50 rounded border border-void-200/30">
                          <span className="font-mono text-void-500">{addr.slice(0, 10)}...{addr.slice(-8)}</span>
                          <span className="text-[10px] uppercase text-void-600 font-medium">Co-Signer #{idx + 1}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <Btn size="sm" onClick={handleSign} className="w-full bg-void-200 hover:bg-void-300 text-white border-void-300 text-xs py-2">
                        ✍️ Sign with Connected Wallet
                      </Btn>
                      
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Paste co-signer signature here..."
                          value={manualSignature}
                          onChange={e => setManualSignature(e.target.value)}
                          className="flex-1 bg-void-100 border border-void-200 rounded px-2.5 py-1.5 text-xs text-white placeholder-void-500 focus:outline-none focus:border-void-500 font-mono text-[10px]"
                        />
                        <Btn size="sm" onClick={handleAddManualSignature} className="bg-neon-green-dim text-void text-xs py-1.5">
                          Add
                        </Btn>
                      </div>
                    </div>

                    {signatures.length > 0 && (
                      <div className="pt-2 border-t border-void-200/50">
                        <p className="text-[10px] font-semibold uppercase text-void-600 mb-1">Loaded Signatures:</p>
                        <div className="space-y-1">
                          {signatures.map((sig, i) => (
                            <div key={i} className="flex items-center justify-between bg-void-200/40 p-1.5 rounded border border-void-300/30">
                              <span className="font-mono text-[10px] text-void-500 truncate max-w-[80%]">{sig}</span>
                              <button onClick={() => setSignatures(prev => prev.filter((_, idx) => idx !== i))} className="text-void-400 hover:text-red-500 text-[10px] px-1 font-bold">×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Visualization during reconstruction */}
                {reconPhase !== 'idle' && (
                  <div className="space-y-2">
                    <FragmentViz
                      phase={reconPhase === 'verifying' ? 'idle' : reconPhase === 'fetching' ? 'distributing' : reconPhase === 'assembling' ? 'assembling' : 'complete'}
                      progress={reconJob?.progress ?? 0}
                    />
                    {reconJob && (
                      <div className="space-y-2">
                        <ProgressBar value={reconJob.progress} color="bg-neon-green-dim" />
                        <p className="text-xs text-void-500 font-mono">{reconJob.message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Download ready */}
                {downloadUrl && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-green-950/40 border border-neon-green-dim/40 rounded-lg text-center">
                    <p className="text-neon-green text-xs mb-2">File reconstructed & verified ✓ — single-use link ready</p>
                    <Btn onClick={handleDownload} className="w-full bg-neon-green-dim hover:bg-neon-green text-void">
                      ⬇ Download {asset.originalName}
                    </Btn>
                    <p className="text-void-500 text-xs mt-1">Link expires in 5 minutes</p>
                  </motion.div>
                )}

                {reconPhase === 'idle' && !downloadUrl && (
                  <Btn
                    onClick={handleReconstruct}
                    className="w-full"
                    disabled={asset.isTeamIP && asset.teamSettings && signatures.length < asset.teamSettings.threshold}
                  >
                    {asset.isTeamIP && asset.teamSettings && signatures.length < asset.teamSettings.threshold
                      ? `🔓 Multi-sig threshold not met (${signatures.length}/${asset.teamSettings.threshold})`
                      : '🔓 Reconstruct & Download File'}
                  </Btn>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
