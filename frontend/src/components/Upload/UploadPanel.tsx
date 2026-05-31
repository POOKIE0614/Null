import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { apiService, pollUntilDone } from '../../services/api'
import { useStore } from '../../store/store'
import { UploadJob, LicenseType, IPAsset } from '../../types'
import { FragmentViz } from '../UI/FragmentViz'
import { ProgressBar, Btn, Badge, Card } from '../UI'
import { fmt } from '../../utils/helpers'

interface Props { onSuccess: (asset: IPAsset) => void }

type VizPhase = 'idle' | 'fragmenting' | 'distributing' | 'complete'

function getVizPhase(status: UploadJob['status']): VizPhase {
  if (status === 'processing') return 'fragmenting'
  if (status === 'distributing') return 'distributing'
  if (status === 'complete') return 'complete'
  return 'idle'
}

export function UploadPanel({ onSuccess }: Props) {
  const { wallet } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    licenseType: 'commercial' as LicenseType,
    priceUSD: '10',
    isTeamIP: false,
    coSigners: '',
    threshold: '2'
  })
  const [job, setJob] = useState<UploadJob | null>(null)
  const [step, setStep] = useState<'drop' | 'meta' | 'running' | 'done'>('drop')

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted[0]) return
    setFile(accepted[0])
    setForm(f => ({ ...f, title: accepted[0].name.replace(/\.[^.]+$/, '') }))
    setStep('meta')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => toast.error('File rejected — max 100MB, no executables'),
  })

  const handleSubmit = async () => {
    if (!file || !wallet) return
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.description.trim()) { toast.error('Description is required'); return }
    if (form.isTeamIP) {
      if (!form.coSigners.trim()) { toast.error('Co-signer wallets are required for Team IP'); return }
      const count = form.coSigners.split(',').map(s => s.trim()).filter(Boolean).length
      const thresholdVal = parseInt(form.threshold, 10)
      if (isNaN(thresholdVal) || thresholdVal < 1) { toast.error('Threshold must be at least 1'); return }
      if (thresholdVal > count) { toast.error(`Threshold (${thresholdVal}) cannot exceed number of co-signers (${count})`); return }
    }

    setStep('running')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('licenseType', form.licenseType)
    fd.append('priceUSD', form.priceUSD)
    fd.append('isTeamIP', String(form.isTeamIP))
    if (form.isTeamIP) {
      fd.append('coSigners', form.coSigners)
      fd.append('threshold', form.threshold)
    }

    try {
      const { jobId } = await apiService.uploadFile(fd)
      const done = await pollUntilDone(
        () => apiService.pollUploadJob(jobId),
        (j) => setJob({ ...j }),
        900
      ) as UploadJob

      setStep('done')
      toast.success('IP Asset registered on Story Protocol!')
      if (done.ipAsset) onSuccess(done.ipAsset)
    } catch (err) {
      toast.error((err as Error).message)
      setStep('meta')
    }
  }

  const reset = () => { setFile(null); setJob(null); setStep('drop'); setForm({ title: '', description: '', licenseType: 'commercial', priceUSD: '10', isTeamIP: false, coSigners: '', threshold: '2' }) }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">

        {/* STEP 1 — Drop */}
        {step === 'drop' && (
          <motion.div key="drop" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {!wallet ? (
              <div className="border-2 border-dashed border-void-200 rounded-xl p-12 text-center">
                <p className="text-void-400 text-sm">Connect a wallet to upload IP</p>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
                  ${isDragActive ? 'border-void-500 bg-void-100/50 scale-[1.01]' : 'border-void-200 hover:border-void-400 hover:bg-void-100/30'}`}
              >
                <input {...getInputProps()} />
                <div className="text-4xl mb-3 opacity-60">⬡</div>
                <p className="text-white font-medium mb-1">{isDragActive ? 'Drop to fragment' : 'Drop any file here'}</p>
                <p className="text-void-500 text-sm mb-4">Images · Audio · Video · Documents · Code · Any format up to 100MB</p>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-void-600">
                  {['🖼 Image', '🎵 Audio', '🎬 Video', '📄 PDF', '🔐 Keys', '💾 Code'].map(t => (
                    <span key={t} className="px-2 py-1 rounded-md bg-void-100 border border-void-200">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2 — Metadata form */}
        {step === 'meta' && file && (
          <motion.div key="meta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
            {/* File preview */}
            <div className="flex items-center gap-3 p-3 bg-void-100 rounded-lg border border-void-200">
              <span className="text-2xl">{fmt.mimeIcon(file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{file.name}</p>
                <p className="text-void-500 text-xs">{fmt.bytes(file.size)} · {fmt.mime(file.type)}</p>
              </div>
              <button onClick={reset} className="text-void-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-void-200 transition-colors">change</button>
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-void-600 mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Name your IP asset"
                  className="w-full bg-void-100 border border-void-200 rounded-lg px-3 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:border-void-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-void-600 mb-1.5">Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what you're protecting and licensing..."
                  rows={3}
                  className="w-full bg-void-100 border border-void-200 rounded-lg px-3 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:border-void-500 transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-void-600 mb-1.5">License type</label>
                  <select value={form.licenseType} onChange={e => setForm(f => ({ ...f, licenseType: e.target.value as LicenseType }))}
                    className="w-full bg-void-100 border border-void-200 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-void-500 transition-colors">
                    <option value="commercial">Commercial</option>
                    <option value="non-commercial">Non-commercial</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-void-600 mb-1.5">Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-void-500 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={form.priceUSD}
                      onChange={e => setForm(f => ({ ...f, priceUSD: e.target.value }))}
                      className="w-full bg-void-100 border border-void-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-void-500 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Team IP toggle */}
              <div className="p-3 bg-void-100/50 rounded-lg border border-void-200/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-xs font-medium block">Team IP / Multi-Sig Reconstruction</span>
                    <span className="text-[10px] text-void-500 block">Require co-signer approvals to download this file.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isTeamIP}
                    onChange={e => setForm(f => ({ ...f, isTeamIP: e.target.checked }))}
                    className="w-4 h-4 bg-void-100 border-void-200 rounded text-void-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                </div>

                {form.isTeamIP && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-2 border-t border-void-200/40"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-void-600 mb-1">
                        Co-Signer Wallets (comma-separated address list)
                      </label>
                      <textarea
                        value={form.coSigners}
                        onChange={e => setForm(f => ({ ...f, coSigners: e.target.value }))}
                        placeholder="0x123..., 0xabc..."
                        rows={2}
                        className="w-full bg-void-100 border border-void-200 rounded-lg px-3 py-2 text-xs text-white placeholder-void-500 focus:outline-none focus:border-void-500 transition-colors resize-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-void-600 mb-1">
                        Reconstruction Threshold (M of N signatures)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.threshold}
                        onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                        className="w-full bg-void-100 border border-void-200 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-void-500 transition-colors"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Shamir info */}
            <div className="p-3 bg-void-100 rounded-lg border border-void-200 text-xs text-void-500 space-y-1">
              <p className="text-void-600 font-medium mb-1">How your file will be protected</p>
              <p>→ SHA-256 fingerprinted & chunked into 64KB pieces</p>
              <p>→ Each chunk split into <span className="text-void-700">10 Shamir shares</span> (any 6 reconstruct — 5 or fewer = zero information)</p>
              <p>→ Fragments distributed to <span className="text-void-700">10 independent storage nodes</span></p>
              <p>→ Location map attached to IP asset via <span className="text-void-700">Story Protocol CDR</span></p>
            </div>

            <div className="flex gap-3">
              <Btn variant="secondary" onClick={reset} className="flex-1">Back</Btn>
              <Btn onClick={handleSubmit} className="flex-1">Fragment & Register IP →</Btn>
            </div>
          </motion.div>
        )}

        {/* STEP 3 — Running */}
        {step === 'running' && (
          <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <FragmentViz
              phase={job ? getVizPhase(job.status) : 'fragmenting'}
              progress={job?.progress ?? 0}
            />
            {job && (
              <div className="space-y-3">
                <ProgressBar value={job.progress} color="bg-void-500" />
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-void-600 animate-pulse" />
                  <p className="text-xs text-void-500 font-mono">{job.message}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Status', value: job.status },
                    { label: 'Progress', value: `${job.progress}%` },
                    { label: 'Phase', value: getVizPhase(job.status) },
                  ].map(s => (
                    <div key={s.label} className="bg-void-100 rounded-lg p-2 border border-void-200">
                      <p className="text-xs text-void-500 mb-0.5">{s.label}</p>
                      <p className="text-xs font-mono text-void-700">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 4 — Done */}
        {step === 'done' && job?.ipAsset && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="text-center py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-green-950 border-2 border-neon-green-dim flex items-center justify-center text-2xl mx-auto mb-3">
                ✓
              </motion.div>
              <h3 className="text-white font-semibold text-lg">IP Asset Registered</h3>
              <p className="text-void-500 text-sm mt-1">Your file is protected and listed on Story Protocol</p>
            </div>
            <div className="bg-void-100 rounded-xl p-4 border border-void-200 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-void-500">Title</span><span className="text-white">{job.ipAsset.title}</span></div>
              <div className="flex justify-between"><span className="text-void-500">IP ID</span><span className="font-mono text-void-600 text-xs">{fmt.hash(job.ipAsset.ipId)}</span></div>
              <div className="flex justify-between"><span className="text-void-500">Tx Hash</span><span className="font-mono text-void-600 text-xs">{fmt.hash(job.ipAsset.txHash)}</span></div>
              <div className="flex justify-between"><span className="text-void-500">File size</span><span className="text-white">{fmt.bytes(job.ipAsset.totalSize)}</span></div>
              <div className="flex justify-between"><span className="text-void-500">License</span><Badge variant="purple">{job.ipAsset.licenseType}</Badge></div>
              <div className="flex justify-between"><span className="text-void-500">Price</span><span className="text-neon-green">{fmt.usd(job.ipAsset.priceUSD)}</span></div>
            </div>
            <Btn onClick={reset} variant="secondary" className="w-full">Upload another file</Btn>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
