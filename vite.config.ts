import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
  test: {
    // Dos proyectos: el frontend (jsdom) y el servidor (Node). Los specs de Playwright
    // (e2e/) no entran aquí: los ejecuta `npm run test:e2e`.
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: true,
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          setupFiles: ['./server/test/setup.ts'],
          include: ['server/**/*.test.ts'],
          // Los tests de integración comparten una única base de datos de pruebas: un solo
          // proceso, ficheros uno detrás de otro.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
})
