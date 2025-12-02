import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import LandingPage from './pages/LandingPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const MagicLinkPage = lazy(() => import('./pages/auth/MagicLinkPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ApplicationPage = lazy(() => import('./pages/application/ApplicationPage'));
const ViewApplicationPage = lazy(() => import('./pages/application/ViewApplicationPage'));
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'));
const ChatPage = lazy(() => import('./pages/chat/ChatPage'));
const AdminChatPage = lazy(() => import('./pages/admin/AdminChatPage'));
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'));
const BookAppointmentPage = lazy(() => import('./pages/appointments/BookAppointmentPage'));
const PassPage = lazy(() => import('./pages/pass/PassPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const ClientsPage = lazy(() => import('./pages/admin/ClientsPage'));
const ApplicationDetailsPage = lazy(() => import('./pages/admin/ApplicationDetailsPage'));
const AppointmentsAdminPage = lazy(() => import('./pages/admin/AppointmentsAdminPage'));
const ScannerPage = lazy(() => import('./pages/admin/ScannerPage'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage'));
const CertificatesPage = lazy(() => import('./pages/admin/CertificatesPage'));
const VerifyPage = lazy(() => import('./pages/verify/VerifyPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const HelpPage = lazy(() => import('./pages/help/HelpPage'));
const HelpCenterPage = lazy(() => import('./pages/help/HelpCenterPage'));
const PrivacyPage = lazy(() => import('./pages/privacy/PrivacyPage'));

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: <LandingPage />,
        },
        {
          path: 'verify',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <VerifyPage />
            </Suspense>
          ),
        },
        {
          path: 'verify/:id',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <VerifyPage />
            </Suspense>
          ),
        },
        {
          path: 'help',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <HelpPage />
            </Suspense>
          ),
        },
        {
          path: 'privacy',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <PrivacyPage />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: '/auth',
      element: <AuthLayout />,
      children: [
        {
          path: 'login',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <LoginPage />
            </Suspense>
          ),
        },
        {
          path: 'register',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <RegisterPage />
            </Suspense>
          ),
        },
        {
          path: 'forgot-password',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <ForgotPasswordPage />
            </Suspense>
          ),
        },
        {
          path: 'magic-link',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <MagicLinkPage />
            </Suspense>
          ),
        },
        {
          path: 'reset-password',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <ResetPasswordPage />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: '/onboarding',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <OnboardingPage />
        </Suspense>
      ),
    },
    {
      path: '/dashboard',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <DashboardPage />
        </Suspense>
      ),
    },
    {
      path: '/help-center',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <HelpCenterPage />
        </Suspense>
      ),
    },
    {
      path: '/application',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <ApplicationPage />
        </Suspense>
      ),
    },
    {
      path: '/application/view',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <ViewApplicationPage />
        </Suspense>
      ),
    },
    {
      path: '/documents',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <DocumentsPage />
        </Suspense>
      ),
    },
    {
      path: '/chat',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <ChatPage />
        </Suspense>
      ),
    },
    {
      path: '/appointments',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <AppointmentsPage />
        </Suspense>
      ),
    },
    {
      path: '/appointments/book',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <BookAppointmentPage />
        </Suspense>
      ),
    },
    {
      path: '/pass',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <PassPage />
        </Suspense>
      ),
    },
    {
      path: '/settings',
      element: (
        <Suspense fallback={<LoadingSpinner />}>
          <SettingsPage />
        </Suspense>
      ),
    },
    {
      path: '/admin',
      element: (
        <ProtectedAdminRoute>
          <AdminLayout />
        </ProtectedAdminRoute>
      ),
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <AdminDashboardPage />
            </Suspense>
          ),
        },
        {
          path: 'clients',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <ClientsPage />
            </Suspense>
          ),
        },
        {
          path: 'applications/:applicationId',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <ApplicationDetailsPage />
            </Suspense>
          ),
        },
        {
          path: 'appointments',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <AppointmentsAdminPage />
            </Suspense>
          ),
        },
        {
          path: 'chat',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <AdminChatPage />
            </Suspense>
          ),
        },
        {
          path: 'settings',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <SettingsPage />
            </Suspense>
          ),
        },
        {
          path: 'scanner',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <ScannerPage />
            </Suspense>
          ),
        },
        {
          path: 'audit',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <AuditPage />
            </Suspense>
          ),
        },
        {
          path: 'certificates',
          element: (
            <Suspense fallback={<LoadingSpinner />}>
              <CertificatesPage />
            </Suspense>
          ),
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  }
);

const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;

