import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<{ needsConfirmation: true; email: string } | { user: User; token: string }>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook export - must be before component export for Fast Refresh
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Component export
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const stateRef = { hasReceivedInitialState: false };

    // Set up auth state listener first - this will handle INITIAL_SESSION event
    // which fires when Supabase restores a session from localStorage
    const subscription = authService.onAuthStateChange(async (user) => {
      if (mounted) {
        setUser(user);
        stateRef.hasReceivedInitialState = true;
        setIsLoading(false);
      }
    });

    // Also check for existing session immediately
    // This ensures we have the user even if the listener hasn't fired yet
    const checkSession = async () => {
      // No artificial delay needed. 
      // We want to check immediately if we can.

      // Only check if we haven't received an initial state from the listener
      if (!stateRef.hasReceivedInitialState && mounted) {
        try {
          const currentUser = await authService.getCurrentUser();
          if (mounted && !stateRef.hasReceivedInitialState) {
            // Only set if listener still hasn't fired to avoid race conditions overwriting newer state
            setUser(currentUser);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Failed to get current user:', error);
          if (mounted && !stateRef.hasReceivedInitialState) {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user } = await authService.login({ email, password });
      setUser(user);
      return user; // Return user so LoginPage can check role immediately
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    // Don't set isLoading during registration - it causes AuthLayout to show loading spinner
    // and unmount the RegisterPage, preventing the confirmation screen from showing
    try {
      // Register will always return needsConfirmation: true
      const result = await authService.register({ email, password, name, phone });
      console.log('AuthContext register result:', result);

      // Always return the result (which should have needsConfirmation: true)
      // The RegisterPage will handle showing the confirmation screen
      return result;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      await authService.signInWithGoogle();
      // Note: signInWithGoogle will redirect the user to Google, so we don't need to handle the response here
      // The OAuth callback will be handled by Supabase and the session will be created automatically
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        signInWithGoogle,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Named exports for Fast Refresh compatibility
export { useAuth, AuthProvider };
