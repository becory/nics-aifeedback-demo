/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages project site: https://zeroflare.github.io/nics-aifeedback-demo/
export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/types/**'],
      // lcov paths relative to the repo root (frontend/src/...), as SonarQube expects.
      reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5296',
        changeOrigin: true,
      },
    },
  },
})
