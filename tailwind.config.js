/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rust: '#c44829',
        paper: '#f4ede0',
        dark: '#1a1612',
        gold: '#d4a02a',
      },
      fontFamily: {
        fraunces: ["'Fraunces'", 'serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-3px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(3px)' },
        },
        pinPulse: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        tabBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        reactionPop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        shutterRing: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        screenEnter: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        dropBanner: {
          '0%': { transform: 'translateY(-100%)' },
          '60%': { transform: 'translateY(4px)' },
          '80%': { transform: 'translateY(-2px)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        shake: 'shake 0.6s ease-in-out infinite',
        'pin-pulse': 'pinPulse 2s ease-out infinite',
        'tab-bounce': 'tabBounce 0.25s ease',
        'reaction-pop': 'reactionPop 0.2s ease',
        'shutter-ring': 'shutterRing 0.4s ease-out forwards',
        'screen-enter': 'screenEnter 0.3s ease forwards',
        'drop-banner': 'dropBanner 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
    },
  },
  plugins: [],
}
