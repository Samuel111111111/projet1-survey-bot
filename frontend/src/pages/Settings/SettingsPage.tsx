import React from 'react';
import Card from '@/components/Card';
import Select from '@/components/Select';
import { useSettingsStore, Theme, Language } from '@/store/useSettingsStore';
import { useTranslation } from 'react-i18next';
import Button from '@/components/Button';

/**
 * SettingsPage allows the user to customise UI preferences such as
 * theme (light/dark) and language. These preferences are stored in
 * Zustand and persisted across sessions. Changing the language
 * immediately updates the i18n instance as well.
 */
const SettingsPage: React.FC = () => {
  const { theme, language, setTheme, setLanguage, toggleTheme } = useSettingsStore();
  const { t, i18n } = useTranslation();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Theme;
    setTheme(value);
  };
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Language;
    setLanguage(value);
    i18n.changeLanguage(value);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label={t('settings.theme')}
            value={theme}
            onChange={handleThemeChange}
            options={[
              { value: 'light', label: t('settings.light') },
              { value: 'dark', label: t('settings.dark') },
            ]}
          />
          <Select
            label={t('settings.language')}
            value={language}
            onChange={handleLanguageChange}
            options={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'es', label: 'Español' },
            ]}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('settings.note')}
        </p>
      </Card>
    </div>
  );
};

export default SettingsPage;