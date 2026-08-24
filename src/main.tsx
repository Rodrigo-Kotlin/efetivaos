import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { App } from '@/app/app'
import '@/styles/globals.css'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const accepted = window.confirm('Uma nova versão do Efetiva OS está disponível. Atualizar agora? Alterações não salvas serão descartadas.')
    if (accepted) void updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
