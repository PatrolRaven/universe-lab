import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Keep the Three.js runtime together as a cacheable vendor bundle.
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
})
