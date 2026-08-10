import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  /**
   * RELATIVE PATHS, FOR ITCH.IO. The store serves an uploaded game from a
   * deep CDN subdirectory, so the default absolute `/assets/...` URLs 404
   * on the very first load. `./` makes the bundle location-independent —
   * it runs from itch, from a file share, from any subfolder anywhere.
   */
  base: './',
})
