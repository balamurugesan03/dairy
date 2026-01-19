import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mantine': [
            '@mantine/core',
            '@mantine/hooks',
            '@mantine/form',
            '@mantine/notifications',
            '@mantine/modals',
            '@mantine/dates',
            '@mantine/dropzone'
          ],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-icons': ['@tabler/icons-react', 'react-icons'],
          'vendor-utils': ['axios', 'dayjs', 'jspdf', 'jspdf-autotable', 'xlsx']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mantine/core',
      '@mantine/hooks',
      'axios'
    ]
  },
  server: {
    hmr: {
      overlay: false
    }
  }
})
