import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'classnames';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Sidebar navigation component. It can be collapsed to only show icons.
 */
type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuthStore();
  const { t } = useTranslation();


  const navItems = [
    { label: t('dashboard.title'), path: '/', icon: '🏠' },
    { label: t('campaigns.my_campaigns'), path: '/campaigns', icon: '📊' },
    { label: t('campaigns.create_campaign'), path: '/campaigns/create', icon: '➕' },
    { label: t('qr.title'), path: '/qr-codes', icon: '🔳' },
    { label: t('settings.title'), path: '/settings', icon: '⚙️' },
    { label: t('profile.title'), path: '/profile', icon: '👤' },
    ...(user?.role === 'admin'
      ? [
          { label: t('logs.title'), path: '/logs', icon: '📜' },
          { label: 'Users', path: '/admin/users', icon: '🧑‍💼' },
        ]
      : []),
  ];


  const content = (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex items-center justify-between p-4 h-16">
        <span className={clsx('font-bold text-lg truncate', collapsed && 'hidden')}>{t('app.name')}</span>
        <button
          className="text-xl focus:outline-none"
          onClick={onToggleCollapsed}
          aria-label="Toggle sidebar"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      <nav className="mt-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => mobileOpen && onCloseMobile()}
            className={({ isActive }) =>
              clsx(
                'flex items-center px-4 py-2 text-sm font-medium transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                isActive && 'bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light'
              )
            }
          >
            <span className="text-lg mr-3">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block h-full">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            aria-label="Close sidebar"
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobile}
          />
          <div className="relative h-full">{content}</div>
        </div>
      )}
    </>
  );
};

export default Sidebar;