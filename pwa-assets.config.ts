import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates PWA icons (192, 512, maskable, apple-touch, favicon) from public/logo.svg.
// Run with: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background: '#ea580c' } },
    apple: { ...preset.apple, padding: 0.1, resizeOptions: { background: '#ea580c' } },
  },
  images: ['public/logo.svg'],
})
