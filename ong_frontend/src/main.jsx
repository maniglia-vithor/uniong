import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-datepicker/dist/react-datepicker.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { RoleProvider } from './context/RoleContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <RoleProvider>
        <App />
      </RoleProvider>
    </ThemeProvider>
  </StrictMode>,
)
