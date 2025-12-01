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
  const { login, user, signInWithGoogle } = useAuth();
  const { showToast } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Note: signInWithGoogle will redirect to Google, so we don't need to handle navigation here
    } catch (error: any) {
      showToast(error.message || 'Google sign-in failed. Please try again.', 'error');
      setIsGoogleLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 shadow-xl">
      <div className="mb-3 sm:mb-5">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1">Welcome Back</h1>
        <p className="text-xs sm:text-sm text-gray-600">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={16} className="sm:w-[18px] sm:h-[18px]" />}
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
            leftIcon={<Lock size={16} className="sm:w-[18px] sm:h-[18px]" />}
            error={errors.password?.message}
            showPasswordToggle={true}
            autoComplete="current-password"
            {...register('password')}
            required
          />
          <div className="mt-1 flex items-center justify-between">
            <Link
              to="/auth/forgot-password"
              className="text-[11px] sm:text-xs text-gold-600 hover:text-gold-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full"
        >
          Sign In
          <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
        </Button>
      </form>

      <div className="mt-3 sm:mt-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-[10px] sm:text-xs">
            <span className="px-2 sm:px-3 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          isLoading={isGoogleLoading}
          onClick={handleGoogleSignIn}
          className="w-full mt-2.5 sm:mt-3 border-gray-300 hover:bg-gray-50"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </Button>
      </div>

      <div className="mt-3 sm:mt-4 text-center">
        <p className="text-[11px] sm:text-xs text-gray-600">
          Don't have an account?{' '}
          <Link to="/auth/register" className="text-gold-600 hover:text-gold-700 font-medium">
            Sign up
          </Link>
        </p>
      </div>

      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
        <Link
          to="/auth/magic-link"
          className="block text-center text-[11px] sm:text-xs text-gray-600 hover:text-gold-600 font-medium"
        >
          Sign in with magic link
        </Link>
      </div>
    </Card>
  );
};

export default LoginPage;

