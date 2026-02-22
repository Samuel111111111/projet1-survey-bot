import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'fr' | 'es';

interface SettingsState {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  toggleTheme: () => void;
}

// Store user interface preferences such as theme and language. These are
// persisted via Zustand's default storage (localStorage).
export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));