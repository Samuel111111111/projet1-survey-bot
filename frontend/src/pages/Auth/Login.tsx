import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

const loginSchema = z.object({
  login: z.string().nonempty('Login is required'),
  password: z.string().nonempty('Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { setTokens, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (values: LoginForm) => {
    try {
      const res = await api.post('/auth/login', values);
      const { access_token, refresh_token, user } = res.data;
      setTokens(access_token, refresh_token);
      setUser(user);
      addToast('success', t('common.create') + 'd');
      navigate('/');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      addToast('error', message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">{t('auth.login_title')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="login"
            type="text"
            label={t('auth.username')}
            error={errors.login?.message}
            {...register('login')}
          />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label={t('auth.password')}
            error={errors.password?.message}
            rightElement={
              <span onClick={() => setShowPassword(!showPassword)} className="text-sm text-gray-500">
                {showPassword ? '🙈' : '👁️'}
              </span>
            }
            {...register('password')}
          />
          <div className="flex items-center justify-between">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              {t('auth.forgot_password')}
            </Link>
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {t('auth.login')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-center">
          {t('auth.no_account')} <Link to="/register" className="text-primary hover:underline">{t('auth.register')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;