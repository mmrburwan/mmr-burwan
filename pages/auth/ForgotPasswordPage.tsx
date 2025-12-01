import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth';
import { useNotification } from '../../contexts/NotificationContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordPage: React.FC = () => {
  const { showToast } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await authService.forgotPassword(data.email);
      setIsSubmitted(true);
      showToast('Password reset link sent to your email', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send reset link. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="p-4 sm:p-6 shadow-xl text-center">
        <div className="mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <CheckCircle size={20} className="sm:w-6 sm:h-6 text-green-600" />
          </div>
          <h1 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1">Check Your Email</h1>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            We've sent a password reset link to your email. Please check your inbox.
          </p>
        </div>
        <Link to="/auth/login">
          <Button variant="primary" size="md" className="w-full">
            Back to Sign In
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 shadow-xl">
      <div className="mb-3 sm:mb-5">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1">Forgot Password?</h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={16} className="sm:w-[18px] sm:h-[18px]" />}
          error={errors.email?.message}
          {...register('email')}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full"
        >
          Send Reset Link
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

export default ForgotPasswordPage;

