import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mysqlApiPlugin } from './src/server/mysqlApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    mysqlApiPlugin()
  ],
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    exclude: ['@moonshine-ai/moonshine-js'],
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  },
  esbuild: {
    target: 'esnext',
    supported: {
      'top-level-await': true
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
  }
})
