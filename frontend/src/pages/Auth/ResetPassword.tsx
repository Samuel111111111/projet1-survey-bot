import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

const schema = z
  .object({
    email: z.string().email('Invalid email'),
    token: z.string().nonempty('Token is required'),
    new_password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string().min(6),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
type FormValues = z.infer<typeof schema>;

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const initialEmail = (location.state as any)?.email || '';
  const initialToken = (location.state as any)?.token || '';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail, token: initialToken },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post('/auth/reset_password', {
        email: values.email,
        token: values.token,
        new_password: values.new_password,
      });
      addToast('success', 'Password reset successfully');
      navigate('/login');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Reset failed';
      addToast('error', message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">{t('auth.reset_title')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            type="email"
            label={t('auth.email')}
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="token"
            type="text"
            label="Token"
            error={errors.token?.message}
            {...register('token')}
          />
          <Input
            id="new_password"
            type={showPassword ? 'text' : 'password'}
            label={t('auth.password')}
            error={errors.new_password?.message}
            rightElement={
              <span onClick={() => setShowPassword(!showPassword)} className="text-sm text-gray-500">
                {showPassword ? '🙈' : '👁️'}
              </span>
            }
            {...register('new_password')}
          />
          <Input
            id="confirm_password"
            type={showConfirm ? 'text' : 'password'}
            label={t('auth.confirm_password')}
            error={errors.confirm_password?.message}
            rightElement={
              <span onClick={() => setShowConfirm(!showConfirm)} className="text-sm text-gray-500">
                {showConfirm ? '🙈' : '👁️'}
              </span>
            }
            {...register('confirm_password')}
          />
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {t('auth.reset_password')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;