import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import Card from '@/components/Card';
import Button from '@/components/Button';
import Skeleton from '@/components/Skeleton';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/Badge';

interface UserInfo {
  id: number;
  login: string;
  role: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

/**
 * ProfilePage displays basic information about the currently logged-in
 * user. The backend's /auth/me endpoint returns id, login and role.
 * Additional fields such as first_name, last_name or email are
 * optional and may not be returned depending on the backend
 * implementation. Users can also log out from this page.
 */
const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (error) {
        addToast('error', 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [addToast]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
      {loading ? (
        <Skeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header card */}
          <Card className="lg:col-span-1">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold">
                {(user?.first_name?.[0] || user?.login?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {user?.first_name || user?.last_name ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim() : user?.login}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email || user?.login}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="info">{user?.role || 'user'}</Badge>
              <Badge variant="default">ID: {user?.id}</Badge>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate('/forgot-password')}>
                {t('profile.reset_password')}
              </Button>
              <Button variant="danger" onClick={handleLogout}>
                {t('profile.logout')}
              </Button>
            </div>
          </Card>

          {/* Details */}
          <Card className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.login')}</div>
                <div className="mt-1 font-semibold break-all">{user?.login}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.email')}</div>
                <div className="mt-1 font-semibold break-all">{user?.email || '—'}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.first_name')}</div>
                <div className="mt-1 font-semibold">{user?.first_name || '—'}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('profile.last_name')}</div>
                <div className="mt-1 font-semibold">{user?.last_name || '—'}</div>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-4">
              <div className="font-semibold">Sécurité</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Change ton mot de passe via "Mot de passe oublié" (le backend gère la génération d’un token).
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;