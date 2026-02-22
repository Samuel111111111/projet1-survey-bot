import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  login: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

// We persist the auth state in localStorage to survive page refreshes. Note that
// sensitive tokens should normally be stored in httpOnly cookies, but for
// simplicity we keep them in localStorage here. The refresh logic is handled
// in the API interceptor.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'survey-bot-auth' }
  )
);