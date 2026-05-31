import { useEffect, useRef } from 'react'

interface FragmentVizProps {
  phase: 'idle' | 'fragmenting' | 'distributing' | 'complete' | 'assembling'
  progress: number
  nodeCount?: number
}

export function FragmentViz({ phase, progress, nodeCount = 10 }: FragmentVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tickRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    const cx = w / 2
    const cy = h / 2

    // Pre-compute node positions in a circle
    const nodes = Array.from({ length: nodeCount }, (_, i) => {
      const angle = (i / nodeCount) * Math.PI * 2 - Math.PI / 2
      const r = Math.min(w, h) * 0.38
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, label: `N${i + 1}` }
    })

    // Particles for fragment animation
    interface Particle {
      x: number; y: number; tx: number; ty: number
      life: number; maxLife: number; color: string
      size: number; nodeIdx: number
    }
    const particles: Particle[] = []

    function spawnParticle(node: { x: number; y: number }, idx: number) {
      particles.push({
        x: cx, y: cy,
        tx: node.x, ty: node.y,
        life: 0, maxLife: 60 + Math.random() * 30,
        color: idx % 3 === 0 ? '#7F77DD' : idx % 3 === 1 ? '#5DCAA5' : '#85B7EB',
        size: 2 + Math.random() * 2,
        nodeIdx: idx,
      })
    }

    function draw() {
      tickRef.current++
      ctx.clearRect(0, 0, w, h)

      // Grid background
      ctx.strokeStyle = 'rgba(83,74,183,0.06)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

      // Draw connection lines
      if (phase !== 'idle') {
        nodes.forEach((node, i) => {
          const alpha = phase === 'distributing' || phase === 'complete' ? 0.15 : 0.07
          ctx.strokeStyle = `rgba(127,119,221,${alpha})`
          ctx.lineWidth = 0.5
          ctx.setLineDash([4, 6])
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(node.x, node.y); ctx.stroke()
          ctx.setLineDash([])
        })
      }

      // Draw nodes
      nodes.forEach((node, i) => {
        const isActive = phase !== 'idle' && i < Math.ceil((progress / 100) * nodeCount)
        const radius = 14

        // Glow ring for active nodes
        if (isActive) {
          const grad = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, radius + 12)
          grad.addColorStop(0, 'rgba(127,119,221,0.25)')
          grad.addColorStop(1, 'rgba(127,119,221,0)')
          ctx.fillStyle = grad
          ctx.beginPath(); ctx.arc(node.x, node.y, radius + 12, 0, Math.PI * 2); ctx.fill()
        }

        // Node circle
        ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isActive ? '#0f0d22' : '#0d0c1a'
        ctx.fill()
        ctx.strokeStyle = isActive ? '#534AB7' : '#1a1832'
        ctx.lineWidth = isActive ? 1.5 : 1
        ctx.stroke()

        // Node label
        ctx.fillStyle = isActive ? '#7F77DD' : '#3a3870'
        ctx.font = `500 9px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(node.label, node.x, node.y)

        // Mini fragment count indicator
        if (isActive && phase === 'complete') {
          ctx.fillStyle = '#5DCAA5'
          ctx.font = '8px monospace'
          ctx.fillText('✓', node.x, node.y + radius + 8)
        }
      })

      // Spawn particles during fragmenting/distributing
      if ((phase === 'fragmenting' || phase === 'distributing') && tickRef.current % 6 === 0) {
        const nodeIdx = Math.floor(Math.random() * nodeCount)
        spawnParticle(nodes[nodeIdx], nodeIdx)
      }

      // Assembling — reverse particles
      if (phase === 'assembling' && tickRef.current % 4 === 0) {
        const nodeIdx = Math.floor(Math.random() * nodeCount)
        const node = nodes[nodeIdx]
        particles.push({
          x: node.x + (Math.random() - 0.5) * 10,
          y: node.y + (Math.random() - 0.5) * 10,
          tx: cx, ty: cy,
          life: 0, maxLife: 50 + Math.random() * 20,
          color: '#5DCAA5', size: 2.5, nodeIdx,
        })
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        const t = Math.min(p.life / p.maxLife, 1)
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        p.x = (phase === 'assembling' ? nodes[p.nodeIdx].x : cx) + (p.tx - (phase === 'assembling' ? nodes[p.nodeIdx].x : cx)) * ease
        p.y = (phase === 'assembling' ? nodes[p.nodeIdx].y : cy) + (p.ty - (phase === 'assembling' ? nodes[p.nodeIdx].y : cy)) * ease
        const alpha = Math.sin(t * Math.PI) * 0.9

        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()

        if (p.life >= p.maxLife) particles.splice(i, 1)
      }

      // Center icon
      const coreRadius = 28
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius + 16)
      const coreColor = phase === 'complete' ? '93,202,165' : phase === 'assembling' ? '93,202,165' : '127,119,221'
      coreGrad.addColorStop(0, `rgba(${coreColor},0.2)`)
      coreGrad.addColorStop(1, `rgba(${coreColor},0)`)
      ctx.fillStyle = coreGrad
      ctx.beginPath(); ctx.arc(cx, cy, coreRadius + 16, 0, Math.PI * 2); ctx.fill()

      ctx.beginPath(); ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#0d0c1a'
      ctx.fill()
      ctx.strokeStyle = phase === 'idle' ? '#1a1832' : `rgb(${coreColor})`
      ctx.lineWidth = phase === 'idle' ? 1 : 1.5
      ctx.stroke()

      // Icon text
      ctx.fillStyle = phase === 'idle' ? '#3a3870' : `rgb(${coreColor})`
      ctx.font = '18px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const icon = phase === 'idle' ? '○' : phase === 'fragmenting' ? '⬡' : phase === 'distributing' ? '⟳' : phase === 'assembling' ? '◎' : '✓'
      ctx.fillText(icon, cx, cy)

      // Progress arc
      if (phase !== 'idle' && progress > 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, coreRadius + 6, -Math.PI / 2, -Math.PI / 2 + (progress / 100) * Math.PI * 2)
        ctx.strokeStyle = `rgba(${coreColor},0.6)`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [phase, progress, nodeCount])

  const labels: Record<string, string> = {
    idle: 'Ready to fragment',
    fragmenting: 'Applying Shamir\'s Secret Sharing...',
    distributing: `Distributing to ${nodeCount} nodes...`,
    assembling: 'Fetching & reconstructing fragments...',
    complete: 'Reconstruction verified ✓',
  }

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="w-full" style={{ height: 280 }} />
      <p className="text-xs text-void-500 font-mono mt-1">{labels[phase] ?? phase}</p>
    </div>
  )
}
