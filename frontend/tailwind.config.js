/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          DEFAULT: 'hsl(210,10%,15%)',
          100: 'hsl(210,10%,20%)',
          200: 'hsl(210,10%,40%)',
          300: 'hsl(210,10%,50%)',
          400: 'hsl(210,10%,60%)',
          500: 'hsl(210,10%,70%)',
          600: 'hsl(210,10%,80%)',
          700: 'hsl(210,10%,90%)',
          800: 'hsl(210,10%,95%)',
          900: 'hsl(210,10%,98%)'
        },
        orange: {
          DEFAULT: 'hsl(30,90%,55%)',
          100: 'hsl(30,90%,65%)',
          200: 'hsl(30,90%,45%)'
        },
        void: { DEFAULT: '#07060f', 100: '#0d0c1a', 500: '#07060f' },
        neon: {
          green: '#5DCAA5',
          'green-dim': '#1D9E75',
          amber: '#EF9F27',
          red: '#F09595',
          blue: '#85B7EB'
        }
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'fragment-fly': 'fragmentFly 1.5s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        fragmentFly: { '0%': { transform: 'scale(1) translate(0,0)', opacity: '1' }, '100%': { transform: 'scale(0.3) translate(var(--tx),var(--ty))', opacity: '0' } },
        glow: { from: { boxShadow: '0 0 10px rgba(127,119,221,0.3)' }, to: { boxShadow: '0 0 25px rgba(127,119,221,0.7), 0 0 50px rgba(127,119,221,0.3)' } },
      },
      backgroundImage: {
        'grid-void': 'linear-gradient(rgba(83,74,183,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(83,74,183,0.07) 1px, transparent 1px)'
      },
      backgroundSize: { 'grid-void': '60px 60px' },
    },
  },
  plugins: [],
}
