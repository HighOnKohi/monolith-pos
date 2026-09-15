import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Exposes Vite on the local network (same as --host)
  },
  plugins: [
    react(),
    tailwindcss(),
    mkcert(), // Required plugin for Vite to serve locally over HTTPS
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Group vendor chunks cleanly to avoid tiny fragments or empty chunks
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'lucide-icons'
            }
            if (id.includes('react-router-dom') || id.includes('@remix-run')) {
              return 'vendor-router'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
          }
        },
      },
    },
  },
})
