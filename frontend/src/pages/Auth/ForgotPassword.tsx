import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

const schema = z.object({
  email: z.string().email('Invalid email'),
});
type FormValues = z.infer<typeof schema>;

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post('/auth/reset_password/request', { email: values.email });
      // Show token in success toast for testing; in production, this would be emailed
      const token = res.data.token;
      addToast('success', token ? `Reset token: ${token}` : 'If an account with that email exists, a reset email has been sent.');
      navigate('/reset-password', { state: { email: values.email, token } });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Error requesting reset';
      addToast('error', message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">{t('auth.forgot_title')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            type="email"
            label={t('auth.email')}
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {t('auth.request_reset')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;