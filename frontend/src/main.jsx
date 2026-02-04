/**
 * Main Entry Point
 * ================
 *
 * App structure:
 * ThemeProvider (our custom) -> MantineWrapper (dynamic theme) -> App
 *
 * ThemeProvider-la color theme & color scheme manage aagum.
 * MantineWrapper-la Mantine theme dynamically update aagum.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import '@mantine/dropzone/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { getMantineTheme } from './config/themes';
import App from './App.jsx';

/**
 * MantineWrapper Component
 * ------------------------
 * Ithu ThemeContext-la irundhu color theme eduthu,
 * MantineProvider-ku dynamically pass pannum.
 *
 * Theme change aana udan, whole app re-render aagi
 * pudhu color apply aagum.
 */
const MantineWrapper = ({ children }) => {
  const { colorTheme, colorScheme } = useTheme();

  // Get Mantine theme configuration based on selected color theme
  const mantineTheme = getMantineTheme(colorTheme);

  return (
    <MantineProvider
      theme={mantineTheme}
      defaultColorScheme={colorScheme}
      forceColorScheme={colorScheme}
    >
      <Notifications position="top-right" />
      <ModalsProvider>
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
};

/**
 * Root Render
 * -----------
 * ThemeProvider first, then MantineWrapper, then App.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <MantineWrapper>
        <App />
      </MantineWrapper>
    </ThemeProvider>
  </StrictMode>,
);
