import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

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

export const wagmiConfig = createConfig({
  chains: [storyAeneid],
  connectors: [injected()],
  transports: {
    [storyAeneid.id]: http('https://aeneid.storyrpc.io'),
  },
  ssr: false,
})
