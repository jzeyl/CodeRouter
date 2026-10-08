import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error(
      'Only a Supabase publishable key may be bundled into MoveON. Remove any secret or service-role key from VITE_ variables.',
    )
  }
  if (env.VITE_DATA_SOURCE && !['sample', 'supabase'].includes(env.VITE_DATA_SOURCE)) {
    throw new Error('VITE_DATA_SOURCE must be sample or supabase.')
  }
  return {
    cacheDir: `node_modules/.vite-${mode}`,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
