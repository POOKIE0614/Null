import axios from 'axios'
import { IPAsset, UploadJob, ReconstructJob, License } from '../types'

const api = axios.create({ baseURL: '/api', timeout: 60000 })

api.interceptors.request.use((config) => {
  const wallet = localStorage.getItem('nv_wallet')
  if (wallet) config.headers['x-wallet-address'] = wallet
  return config
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(res: { data: any }): T {
  if (!res.data.ok) throw new Error(res.data.error ?? 'Request failed')
  return res.data.data as T
}

export const apiService = {
  health: () => api.get('/health').then(r => r.data),

  getAllAssets: (): Promise<IPAsset[]> => api.get('/upload/assets').then(unwrap<IPAsset[]>),
  getAsset: (id: string): Promise<IPAsset> => api.get(`/upload/assets/${id}`).then(unwrap<IPAsset>),
  getMyAssets: (): Promise<IPAsset[]> => api.get('/upload/assets/creator').then(unwrap<IPAsset[]>),

  uploadFile: (formData: FormData): Promise<{ jobId: string }> =>
    api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<{ jobId: string }>),
  pollUploadJob: (jobId: string): Promise<UploadJob> => api.get(`/upload/job/${jobId}`).then(unwrap<UploadJob>),

  checkLicense: (assetId: string): Promise<{ hasLicense: boolean; isCreator: boolean }> =>
    api.get(`/access/license/${assetId}/check`).then(unwrap<{ hasLicense: boolean; isCreator: boolean }>),
  purchaseLicense: (assetId: string): Promise<{ txHash: string; licenseId: string }> =>
    api.post(`/access/license/${assetId}`).then(unwrap<{ txHash: string; licenseId: string }>),
  getMyLicenses: (): Promise<License[]> => api.get('/access/licenses').then(unwrap<License[]>),

  startReconstruct: (assetId: string, signatures?: string[]): Promise<{ jobId: string }> =>
    api.post(`/access/reconstruct/${assetId}`, { signatures }).then(unwrap<{ jobId: string }>),
  pollReconstructJob: (jobId: string): Promise<ReconstructJob> =>
    api.get(`/access/reconstruct/job/${jobId}`).then(unwrap<ReconstructJob>),
}

export async function pollUntilDone<T extends { status: string; progress: number }>(
  fetchFn: () => Promise<T>,
  onProgress: (job: T) => void,
  intervalMs = 800
): Promise<T> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const job = await fetchFn()
        onProgress(job)
        if (job.status === 'complete') { clearInterval(interval); resolve(job) }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (job.status === 'failed') { clearInterval(interval); reject(new Error((job as any).error ?? 'Job failed')) }
      } catch (e) { clearInterval(interval); reject(e) }
    }, intervalMs)
  })
}
