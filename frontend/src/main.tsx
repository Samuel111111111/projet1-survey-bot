import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './i18n';
import { ToastProvider } from '@/components/ToastProvider';
import { useSettingsStore } from '@/store/useSettingsStore';

const AppShell: React.FC = () => {
  const { theme } = useSettingsStore();

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  );
};

// Render the root of the application. We wrap everything in React.StrictMode
// and BrowserRouter for client‑side routing.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);