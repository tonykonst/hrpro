module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          slate: {
            850: '#1e293b',
            950: '#0f172a'
          }
        },
        animation: {
          'fade-in': 'fadeIn 0.2s ease-in-out',
          'slide-up': 'slideUp 0.3s ease-out',
          'pulse-slow': 'pulse 3s linear infinite',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' }
          },
          slideUp: {
            '0%': { transform: 'translateY(10px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' }
          }
        },
        backdropBlur: {
          xs: '2px',
        },
        fontFamily: {
          mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
        },
        backgroundImage: {
          'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
          'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        }
      },
    },
    plugins: [
      require('tailwind-scrollbar')({ nocompatible: true }),
    ],
  }