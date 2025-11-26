import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { authService } from '../../services/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { showToast } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Pre-fill form with values from sessionStorage (set during registration)
  useEffect(() => {
    const pendingEmail = sessionStorage.getItem('pendingLoginEmail');
    const pendingPassword = sessionStorage.getItem('pendingLoginPassword');
    
    if (pendingEmail) {
      setValue('email', pendingEmail);
      sessionStorage.removeItem('pendingLoginEmail');
    }
    if (pendingPassword) {
      setValue('password', pendingPassword);
      sessionStorage.removeItem('pendingLoginPassword');
    }
  }, [setValue]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const loggedInUser = await login(data.email, data.password);
      showToast('Welcome back!', 'success');
      
      // Redirect based on user role
      if (loggedInUser?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      showToast(error.message || 'Login failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-8 shadow-xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-600">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={20} />}
          error={errors.email?.message}
          autoComplete="email"
          {...register('email')}
          required
        />

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            leftIcon={<Lock size={20} />}
            error={errors.password?.message}
            showPasswordToggle={true}
            autoComplete="current-password"
            {...register('password')}
            required
          />
          <div className="mt-2 flex items-center justify-between">
            <Link
              to="/auth/forgot-password"
              className="text-sm text-gold-600 hover:text-gold-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full"
        >
          Sign In
          <ArrowRight size={18} className="ml-2" />
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/auth/register" className="text-gold-600 hover:text-gold-700 font-medium">
            Sign up
          </Link>
        </p>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <Link
          to="/auth/magic-link"
          className="block text-center text-sm text-gray-600 hover:text-gold-600 font-medium"
        >
          Sign in with magic link
        </Link>
      </div>
    </Card>
  );
};

export default LoginPage;

