import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      textShadow: {
        'lg': '2px 2px 4px rgba(0,0,0,0.3)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/postcss'),
  ],
}
export default config