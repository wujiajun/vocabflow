import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { App } from './app/App'
import { AppProviders } from './app/providers/AppProviders'
import { installSpeechUnlock } from './shared/speech/unlockSpeech'

// Without a touch listener, iOS Safari does not apply :active, so a press shows no feedback.
document.addEventListener('touchstart', () => {}, { passive: true })

installSpeechUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
)
