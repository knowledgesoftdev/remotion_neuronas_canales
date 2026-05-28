import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5172,
    proxy: {
      '/api': 'http://localhost:5171',
    },
  },
})
