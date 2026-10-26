import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/Layout';
import { initDB } from './lib/db';

function AppRoutes() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    initDB().catch(console.error);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-store-green flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="font-heading text-lg">Loading Galiyat Store POS...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
