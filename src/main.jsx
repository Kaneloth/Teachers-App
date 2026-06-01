import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Apply persisted text size on load
const savedSize = localStorage.getItem('textSize');
const sizeMap = { Small: '14px', Medium: '16px', Large: '19px' };
if (savedSize && sizeMap[savedSize]) {
  document.documentElement.style.fontSize = sizeMap[savedSize];
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)