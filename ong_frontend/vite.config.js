import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend usado pelo proxy do dev server e do "vite preview" (padrão: runserver local na porta 8000).
const API = process.env.VITE_PROXY_API || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': API,
      '/c/': API,
    },
  },
})
