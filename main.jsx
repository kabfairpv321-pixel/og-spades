import React from 'react'
import ReactDOM from 'react-dom/client'
import SpadesApp from './Spades.jsx'
import './index.css'

if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key) => { try { const value = localStorage.getItem(key); return value !== null ? { value } : null; } catch (e) { return null; } },
    set: async (key, value) => { try { localStorage.setItem(key, value); return { value }; } catch (e) { return null; } },
    delete: async (key) => { try { localStorage.removeItem(key); return { deleted: true }; } catch (e) { return null; } },
    list: async () => { try { return { keys: Object.keys(localStorage) }; } catch (e) { return null; } },
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><SpadesApp /></React.StrictMode>
)
