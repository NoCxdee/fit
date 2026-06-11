/* ================================================================
   Fit — Entry Point
   ================================================================ */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './stores/appStore';
import { I18nProvider } from './i18n';
import { DictationProvider } from './hooks/useDictation';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <I18nProvider>
        <DictationProvider>
          <App />
        </DictationProvider>
      </I18nProvider>
    </AppProvider>
  </StrictMode>
);
