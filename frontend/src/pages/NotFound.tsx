import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button';
import { useTranslation } from 'react-i18next';

/**
 * NotFound renders a simple 404 error page with a message and a
 * button to return to the dashboard. It is used for undefined
 * routes.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg">{t('not_found.message')}</p>
      <Button variant="primary" onClick={() => navigate('/')}>{t('not_found.back_home')}</Button>
    </div>
  );
};

export default NotFound;