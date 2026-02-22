import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

/**
 * Topbar component displays page controls such as theme toggle, language
 * selector, and user menu. It reads from the settings and auth stores
 * to render the current state.
 */
const Topbar: React.FC<{ onOpenMobileSidebar?: () => void }> = ({ onOpenMobileSidebar }) => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, setLanguage } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLanguageChange = (lang: 'en' | 'fr' | 'es') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-2">
        {/* Mobile sidebar button */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          aria-label="Open sidebar"
          type="button"
        >
          ☰
        </button>
      </div>

      <div className="flex items-center space-x-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        {/* Language selector */}
        <select
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value as any)}
          className="text-sm bg-transparent focus:outline-none border-none"
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="es">ES</option>
        </select>
        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          >
            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center capitalize">
              {user?.login?.charAt(0) || 'U'}
            </span>
            <span className="hidden md:block text-sm font-medium truncate max-w-[8rem]">
              {user?.login || 'User'}
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-20">
              <button
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/profile');
                }}
              >
                {t('profile.title')}
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
              >
                {t('settings.title')}
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleLogout}
              >
                {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;