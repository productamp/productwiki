import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/index': 'http://localhost:3847',
      '/projects': 'http://localhost:3847',
      '/generate': 'http://localhost:3847',
      '/wiki': 'http://localhost:3847',
      '/logs': 'http://localhost:3847',
      '/jobs': 'http://localhost:3847',
    },
  },
})
