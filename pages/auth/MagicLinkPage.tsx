import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth';
import { useNotification } from '../../contexts/NotificationContext';
import { useTranslation } from '../../hooks/useTranslation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

const createMagicLinkSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t('auth:validation.emailRequired')),
});

type MagicLinkFormData = z.infer<ReturnType<typeof createMagicLinkSchema>>;

const MagicLinkPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useNotification();
  const { t } = useTranslation('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Supabase sends token_hash and type as query params
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const magicLinkSchema = createMagicLinkSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  });

  useEffect(() => {
    // Check if we have token_hash and type from Supabase redirect (for magic links)
    if (tokenHash && type === 'email') {
      handleVerifyToken(tokenHash);
      return;
    }

    // Handle OAuth callback (Google, etc.)
    // Supabase OAuth redirects will have code or error in URL
    if (error) {
      showToast(errorDescription || t('errors.authenticationFailed'), 'error');
      navigate('/auth/login');
      return;
    }

    // If we have a code, Supabase is handling the OAuth flow
    // The session will be created automatically by Supabase
    // We just need to wait a moment and check for the session
    if (code) {
      handleOAuthCallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenHash, type, code, error, errorDescription]);

  const handleVerifyToken = async (tokenHash: string) => {
    setIsLoading(true);
    try {
      // Verify the magic link - this will automatically create a session
      await authService.verifyMagicLink(tokenHash);
      showToast(t('success.signedIn'), 'success');
      
      // Get the current user to determine redirect
      const currentUser = await authService.getCurrentUser();
      if (currentUser?.role === 'admin') {
        navigate('/admin');
      } else if (currentUser?.role === 'agent') {
        navigate('/agent/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      showToast(error.message || t('errors.invalidMagicLink'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthCallback = async () => {
    setIsLoading(true);
    try {
      // Supabase with detectSessionInUrl: true will automatically process the OAuth callback
      // We need to wait a bit for it to complete, then check for the session
      // Poll for session up to 5 seconds
      let currentUser = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        currentUser = await authService.getCurrentUser();
        if (currentUser) {
          break;
        }
      }
      
      if (currentUser) {
        showToast(t('success.signedIn'), 'success');
        
        // Redirect based on user role
        if (currentUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (currentUser.role === 'agent') {
          navigate('/agent/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        // If no user after OAuth, something went wrong
        showToast(t('errors.authenticationFailed'), 'error');
        navigate('/auth/login');
      }
    } catch (error: any) {
      showToast(error.message || t('errors.authenticationFailed'), 'error');
      navigate('/auth/login');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: MagicLinkFormData) => {
    setIsLoading(true);
    try {
      await authService.sendMagicLink(data.email);
      setIsSubmitted(true);
      showToast(t('success.magicLinkSent'), 'success');
    } catch (error: any) {
      showToast(error.message || t('errors.magicLinkFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="p-4 sm:p-6 shadow-xl text-center">
        <div className="mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gold-100 flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <CheckCircle size={20} className="sm:w-6 sm:h-6 text-gold-600" />
          </div>
          <h1 className="font-serif text-lg sm:text-xl font-bold text-gray-900 mb-1">{t('magicLink.success.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            {t('magicLink.success.message')}
          </p>
        </div>
        <Link to="/auth/login">
          <Button variant="ghost" size="sm" className="w-full">
            {t('magicLink.backToSignIn')}
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 shadow-xl">
      <div className="mb-3 sm:mb-5">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1">{t('magicLink.title')}</h1>
        <p className="text-xs sm:text-sm text-gray-600">
          {t('magicLink.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        <Input
          label={t('magicLink.emailLabel')}
          type="email"
          placeholder={t('magicLink.emailPlaceholder')}
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
          {t('magicLink.sendMagicLink')}
          <ArrowRight size={14} className="ml-1.5 sm:w-4 sm:h-4" />
        </Button>
      </form>

      <div className="mt-3 sm:mt-4 text-center">
        <Link
          to="/auth/login"
          className="text-[11px] sm:text-xs text-gold-600 hover:text-gold-700 font-medium"
        >
          {t('magicLink.backToSignIn')}
        </Link>
      </div>
    </Card>
  );
};

export default MagicLinkPage;

