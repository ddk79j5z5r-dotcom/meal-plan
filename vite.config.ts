import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/meal-plan/
export default defineConfig({
  base: '/meal-plan/',
  plugins: [react()],
})
