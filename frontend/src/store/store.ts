import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Wallet, IPAsset } from '../types'

// Two demo wallets — creator and buyer
export const DEMO_WALLETS: Wallet[] = [
  { address: '0xC1234567890abcdef1234567890abcdef1234567', label: 'Creator Wallet', role: 'creator', balance: 500 },
  { address: '0xB0987654321fedcba0987654321fedcba0987654', label: 'Buyer Wallet', role: 'buyer', balance: 1000 },
]

interface Store {
  wallet: Wallet | null
  setWallet: (w: Wallet | null) => void
  assets: IPAsset[]
  setAssets: (a: IPAsset[]) => void
  refreshTrigger: number
  triggerRefresh: () => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      wallet: null,
      setWallet: (wallet) => {
        set({ wallet })
        if (wallet) localStorage.setItem('nv_wallet', wallet.address)
        else localStorage.removeItem('nv_wallet')
      },
      assets: [],
      setAssets: (assets) => set({ assets }),
      refreshTrigger: 0,
      triggerRefresh: () => set((s) => ({ refreshTrigger: s.refreshTrigger + 1 })),
    }),
    { name: 'nullvault-store', partialize: (s) => ({ wallet: s.wallet }) }
  )
)
