import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import 'mantine-datatable/styles.css'
import '@mantine/dropzone/styles.css'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        fontFamily: 'Gabarito, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        headings: { fontFamily: 'Gabarito, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }
      }}
    >
      <Notifications position="top-right" />
      <ModalsProvider>
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
