import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

const verifySchema = z.object({
  email: z.string().email('Invalid email'),
  verification_code: z.string().nonempty('Verification code is required'),
});
type VerifyForm = z.infer<typeof verifySchema>;

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const initialEmail = (location.state as any)?.email || '';
  const initialCode = (location.state as any)?.code || '';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<VerifyForm>({ resolver: zodResolver(verifySchema), defaultValues: { email: initialEmail, verification_code: initialCode } });

  const onSubmit = async (values: VerifyForm) => {
    try {
      await api.post('/auth/verify', values);
      addToast('success', 'Email verified successfully. You may now log in.');
      navigate('/login');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Verification failed';
      addToast('error', message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded shadow">
          <h1 className="text-2xl font-bold mb-4">{t('auth.verify_title')}</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              id="email"
              type="email"
              label={t('auth.email')}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              id="verification_code"
              type="text"
              label={t('auth.verification_code')}
              error={errors.verification_code?.message}
              {...register('verification_code')}
            />
            <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
              {t('common.save')}
            </Button>
          </form>
          <p className="mt-4 text-sm text-center">
            <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
          </p>
      </div>
    </div>
  );
};

export default VerifyEmail;