import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      // The monorepo package isn't available here, so use the local copy of its schemas
      '@workspace/api-zod': fileURLToPath(new URL('./src/shared/api-zod.ts', import.meta.url)),
    },
  },
  css: {
    postcss: {},
  },
})
