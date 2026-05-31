import { defineChain } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const storyAeneid = defineChain({
  id: 1513,
  name: 'Story Aeneid Testnet',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://aeneid.storyrpc.io'] },
    public:  { http: ['https://aeneid.storyrpc.io'] },
  },
  blockExplorers: {
    default: { name: 'Storyscan', url: 'https://aeneid.storyscan.io' },
  },
  testnet: true,
})

export const wagmiConfig = getDefaultConfig({
  appName: 'NullVault',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [storyAeneid],
  ssr: false,
})
