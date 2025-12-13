import { supabase } from '../lib/supabase';
import { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Helper function to convert Supabase user to our User type
const mapSupabaseUser = (supabaseUser: any, role: 'client' | 'admin' = 'client'): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    phone: supabaseUser.user_metadata?.phone || supabaseUser.phone || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    role: supabaseUser.user_metadata?.role || role,
    createdAt: supabaseUser.created_at || new Date().toISOString(),
  };
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    // Supabase signInWithPassword will return an error if user doesn't exist
    // This prevents creating users through login
    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Login failed');
    }

    // Verify that user email is confirmed before allowing login
    // This ensures only verified users can log in
    if (!data.user.email_confirmed_at) {
      throw new Error('Please verify your email address before logging in. Check your inbox for the confirmation link.');
    }

    // Ensure profile exists (backup in case trigger didn't fire)
    // This will only create profile if email is confirmed
    await this.ensureProfileExists(data.user);

    const user = mapSupabaseUser(data.user, data.user.user_metadata?.role || 'client');

    return {
      user,
      token: data.session.access_token,
    };
  },

  async register(data: RegisterData): Promise<AuthResponse | { needsConfirmation: true; email: string }> {
    try {
      // Check if email domain is @mmrburwan.com
      if (data.email.toLowerCase().endsWith('@mmrburwan.com')) {
        // Use custom registration flow for internal users (no email verification)
        const { data: userData, error: fnError } = await supabase.functions.invoke('register-internal-user', {
          body: {
            email: data.email,
            password: data.password,
            name: data.name,
            phone: data.phone,
          },
        });

        if (fnError) {
          console.error('Internal registration error:', fnError);
          throw new Error(fnError.message || 'Registration failed');
        }

        if (userData?.error) {
          if (userData.code === 'USER_ALREADY_EXISTS') {
            throw new Error('User already exists');
          }
          throw new Error(userData.error);
        }

        // Successfully created user. Now log them in automatically.
        const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (loginError) {
          throw new Error('Registration successful but login failed. Please log in.');
        }

        // Check if mapSupabaseUser needs to be called - login returns session, we need to return AuthResponse
        const user = mapSupabaseUser(authData.user, authData.user?.user_metadata?.role || 'client');

        return {
          user,
          token: authData.session?.access_token || '',
        };
      }

      // Standard registration for other domains
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            phone: data.phone,
            role: data.email.includes('admin') ? 'admin' : 'client',
          },
          emailRedirectTo: `${window.location.origin}/auth/magic-link`,
        },
      });

      if (error) {
        console.error('Registration error:', error);
        // Provide more helpful error messages
        if (error.message.includes('rate limit')) {
          throw new Error('Too many registration attempts. Please wait a few minutes and try again.');
        }
        if (error.message.includes('email')) {
          throw new Error('There was an issue with the email address. Please check it and try again.');
        }
        throw new Error(error.message);
      }

      if (!authData.user) {
        throw new Error('Registration failed - no user data returned');
      }

      // Log registration details for debugging
      console.log('Registration successful:', {
        userId: authData.user.id,
        email: data.email,
        emailConfirmed: authData.user.email_confirmed_at,
        confirmationSent: authData.user.confirmation_sent_at,
      });

      // Check if email confirmation was actually sent
      if (!authData.user.confirmation_sent_at && !authData.user.email_confirmed_at) {
        console.warn('Email confirmation may not have been sent. Check Supabase SMTP configuration.');
      }

      // ALWAYS return needsConfirmation for new registrations
      // This ensures the confirmation screen always shows
      // Even if Supabase has email confirmation disabled, we still want to show the screen
      return {
        needsConfirmation: true,
        email: data.email,
      };
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/magic-link`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
    // Note: The redirect will happen automatically, so we don't return anything
    // The user will be redirected to Google, then back to our callback URL
  },

  async sendMagicLink(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/magic-link`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async verifyMagicLink(tokenHash: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email', // Use 'email' type for magic links
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Magic link verification failed');
    }

    // Verify that user email is confirmed
    // This ensures only verified users can use magic links
    if (!data.user.email_confirmed_at) {
      throw new Error('Email not confirmed. Please verify your email address.');
    }

    // Ensure profile exists after email confirmation
    // This will only create profile if email is confirmed
    await this.ensureProfileExists(data.user);

    const user = mapSupabaseUser(data.user, data.user.user_metadata?.role || 'client');

    return {
      user,
      token: data.session.access_token,
    };
  },

  async resendConfirmationEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/magic-link`,
      },
    });

    if (error) {
      console.error('Resend confirmation email error:', error);
      if (error.message.includes('rate limit')) {
        throw new Error('Too many requests. Please wait a few minutes before requesting another email.');
      }
      throw new Error(error.message);
    }
  },

  async forgotPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async resetPassword(tokenHash: string, newPassword: string): Promise<void> {
    // First verify the token hash from the email link
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });

    if (verifyError) {
      throw new Error(verifyError.message);
    }

    // Then update the password
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async updateEmail(newEmail: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      // First check for an existing session (this will use persisted session if available)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        return null;
      }

      if (session?.user) {
        // Ensure profile exists
        await this.ensureProfileExists(session.user);
        return mapSupabaseUser(session.user, session.user.user_metadata?.role || 'client');
      }

      // If no session, try to get user (this will trigger refresh if token is expired)
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      // Optimization: Do NOT call ensureProfileExists on every getSession/getUser.
      // It causes redundant DB calls on every page load.
      // The profile should be created on registration/login or via database triggers.
      // await this.ensureProfileExists(user);

      return mapSupabaseUser(user, user.user_metadata?.role || 'client');
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  },

  // Helper function to ensure profile exists for a user
  // Only creates profile if user email is confirmed
  async ensureProfileExists(user: any): Promise<void> {
    try {
      // Only create profile for verified users
      if (!user.email_confirmed_at) {
        console.log('User email not confirmed, skipping profile creation');
        return;
      }

      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // If profile doesn't exist, create it (only for verified users)
      if (!existingProfile && !checkError) {
        const nameParts = (user.user_metadata?.name || user.email?.split('@')[0] || 'User').split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || null;

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            completion_percentage: 0,
          });

        if (insertError) {
          console.error('Failed to create profile:', insertError);
        }
      }
    } catch (error) {
      console.error('Error ensuring profile exists:', error);
      // Don't throw - this is a best-effort operation
    }
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  getToken(): string | null {
    // This will be handled by Supabase session
    return null;
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    const response = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle all auth events including INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED
      if (session?.user) {
        const user = mapSupabaseUser(session.user, session.user.user_metadata?.role || 'client');
        callback(user);
      } else {
        callback(null);
      }
    });
    // Supabase returns { data: { subscription } }
    // Return a subscription object with unsubscribe method
    const subscription = response.data.subscription;
    return {
      unsubscribe: () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      }
    };
  },
};
