import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Menejer paneli — 5177 portda ishlaydi
export default defineConfig({
  plugins: [react()],
  server: { port: 5177 },
})
