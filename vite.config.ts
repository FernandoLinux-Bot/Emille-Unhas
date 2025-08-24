import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        short_name: "Emille Nails",
        name: "Emille Nails: Agendamento de Pedicure e Manicure",
        icons: [
          {
            src: 'icon-192.png',
            type: 'image/png',
            sizes: '192x192'
          },
          { 
            src: 'icon-512.png',
            type: 'image/png',
            sizes: '512x512'
          },
          {
            src: 'icon-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable'
          }
        ],
        start_url: ".",
        display: "standalone",
        theme_color: "#F8D7DA",
        background_color: "#ffffff",
        description: "Agende seus serviços de manicure e pedicure com facilidade."
      }
    })
  ],
})
