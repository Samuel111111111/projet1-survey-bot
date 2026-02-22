import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from 'react-i18next';

const registerSchema = z
  .object({
    first_name: z.string().nonempty('First name is required'),
    last_name: z.string().nonempty('Last name is required'),
    email: z.string().email('Invalid email'),
    login: z.string().nonempty('Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string().min(6, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
type RegisterForm = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (values: RegisterForm) => {
    try {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        login: values.login,
        password: values.password,
      };
      const res = await api.post('/auth/register', payload);
      addToast('success', 'Registration successful. Please verify your email.');
      // Redirect to verification page with email param so the user can enter the code
      navigate('/verify', { state: { email: values.email, code: res.data.verification_code } });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      addToast('error', message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">{t('auth.register_title')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <Input
              id="first_name"
              type="text"
              label={t('auth.first_name')}
              error={errors.first_name?.message}
              {...register('first_name')}
            />
          </div>
          <div className="col-span-1">
            <Input
              id="last_name"
              type="text"
              label={t('auth.last_name')}
              error={errors.last_name?.message}
              {...register('last_name')}
            />
          </div>
          <div className="col-span-2">
            <Input
              id="email"
              type="email"
              label={t('auth.email')}
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="col-span-2">
            <Input
              id="login"
              type="text"
              label={t('auth.username')}
              error={errors.login?.message}
              {...register('login')}
            />
          </div>
          <div className="col-span-1">
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
          </div>
          <div className="col-span-1">
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
          </div>
          <div className="col-span-2">
            <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
              {t('auth.register')}
            </Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-center">
          {t('auth.have_account')} <Link to="/login" className="text-primary hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;