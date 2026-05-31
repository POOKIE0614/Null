import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Btn } from '../components/UI'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-6xl mb-4 opacity-20">○</div>
        <h1 className="text-white text-2xl font-light mb-2">This page doesn't exist</h1>
        <p className="text-void-500 text-sm mb-6">
          Like data below the Shamir threshold — nothing here.
        </p>
        <Btn onClick={() => navigate('/')}>← Back to home</Btn>
      </motion.div>
    </div>
  )
}
