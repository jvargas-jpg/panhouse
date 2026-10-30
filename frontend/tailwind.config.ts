import type { Config } from 'tailwindcss';

// Identidad de marca: nunca repetir estos valores sueltos en el código,
// siempre a través de las clases dorado/tinta/crema (bg-dorado,
// text-tinta, etc.) — así un cambio de paleta se hace en un solo lugar.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dorado: 'rgb(var(--ph-gold-rgb) / <alpha-value>)',
        tinta: 'rgb(var(--ph-tinta-rgb) / <alpha-value>)',
        crema: 'rgb(var(--ph-bg-rgb) / <alpha-value>)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
