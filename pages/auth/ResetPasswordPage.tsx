import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth';
import { useNotification } from '../../contexts/NotificationContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Supabase sends token_hash and type as URL hash fragments or query params
  const tokenHash = searchParams.get('token_hash') || new URLSearchParams(window.location.hash.substring(1)).get('token_hash');
  const type = searchParams.get('type') || new URLSearchParams(window.location.hash.substring(1)).get('type');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // If no token_hash or wrong type, redirect to forgot password
    if (!tokenHash || type !== 'recovery') {
      showToast('Invalid or missing reset token', 'error');
      navigate('/auth/forgot-password');
    }
  }, [tokenHash, type, navigate, showToast]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!tokenHash) return;

    setIsLoading(true);
    try {
      await authService.resetPassword(tokenHash, data.password);
      setIsSuccess(true);
      showToast('Password reset successfully!', 'success');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth/login');
      }, 2000);
    } catch (error: any) {
      showToast(error.message || 'Failed to reset password. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="p-4 sm:p-6 shadow-xl text-center">
        <div className="mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <CheckCircle size={20} className="sm:w-6 sm:h-6 text-green-600" />
          </div>
          <h1 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1">Password Reset Successful!</h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Your password has been reset. Redirecting to login...
          </p>
        </div>
        <Link to="/auth/login">
          <Button variant="primary" size="md" className="w-full">
            Go to Sign In
            <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  if (!tokenHash) {
    return null; // Will redirect in useEffect
  }

  return (
    <Card className="p-4 sm:p-6 shadow-xl">
      <div className="mb-3 sm:mb-5">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1">Reset Password</h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        <Input
          label="New Password"
          type="password"
          placeholder="Enter new password"
          leftIcon={<Lock size={16} className="sm:w-[18px] sm:h-[18px]" />}
          error={errors.password?.message}
          showPasswordToggle={true}
          {...register('password')}
          required
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="Confirm new password"
          leftIcon={<Lock size={16} className="sm:w-[18px] sm:h-[18px]" />}
          error={errors.confirmPassword?.message}
          showPasswordToggle={true}
          {...register('confirmPassword')}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full"
        >
          Reset Password
          <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
        </Button>
      </form>

      <div className="mt-3 sm:mt-4 text-center">
        <Link
          to="/auth/login"
          className="text-[11px] sm:text-xs text-gold-600 hover:text-gold-700 font-medium"
        >
          Back to Sign In
        </Link>
      </div>
    </Card>
  );
};

export default ResetPasswordPage;

