import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Eye, EyeOff, Lock, User, Wifi } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please enter username and password'); return; }
    setIsLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-store-green-dark via-store-green to-store-green-light flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 200 + 50}px`,
              height: `${Math.random() * 200 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo card */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl mb-4">
            <ShoppingBag className="w-10 h-10 text-store-green" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-heading font-bold text-white mb-1">گلیات اسٹور</h1>
          <p className="text-green-100 font-body text-lg">Galiyat Store POS System</p>
        </div>

        {/* Login card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 animate-fade-in">
          <h2 className="text-2xl font-heading font-bold text-gray-800 mb-2">Welcome Back</h2>
          <p className="text-gray-500 font-body mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-store-green/50 focus:border-store-green transition-all font-body text-gray-800 bg-gray-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-store-green/50 focus:border-store-green transition-all font-body text-gray-800 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-store-green text-white font-heading font-bold text-lg rounded-xl hover:bg-store-green-dark active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-store-green/30"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In to POS'}
            </button>
          </form>

          {/* Offline notice */}
          <div className="mt-6 p-3 bg-blue-50 rounded-xl flex items-center gap-2 text-sm text-blue-700">
            <Wifi className="w-4 h-4 flex-shrink-0" />
            <span>Offline mode available — sales will sync when connection is restored</span>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 mb-1">Demo Credentials:</p>
            <p>Admin: <code className="bg-gray-200 px-1 rounded">admin</code> / <code className="bg-gray-200 px-1 rounded">admin123</code></p>
            <p>Cashier: <code className="bg-gray-200 px-1 rounded">cashier1</code> / <code className="bg-gray-200 px-1 rounded">cashier123</code></p>
          </div>
        </div>

        <p className="text-center text-green-100/70 text-sm mt-6 font-body">
          © 2025 Galiyat Store POS System
        </p>
      </div>
    </div>
  );
}
