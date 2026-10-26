import { useState, useEffect } from 'react';
import { Users, Plus, X, ToggleLeft, ToggleRight, Shield } from 'lucide-react';
import { authApi, User } from '../lib/api';
import { formatDateTime } from '../lib/utils';
import { api } from '../lib/api';

interface UserWithRoles extends User {
  isActive?: boolean;
  lastLoginAt?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    fullName: '', username: '', password: '', phone: '',
    email: '', role: 'CASHIER',
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<UserWithRoles[]>('/api/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!form.fullName || !form.username || !form.password || !form.phone) {
      setError('Please fill in all required fields'); return;
    }
    setSaving(true); setError('');
    try {
      await api.post('/api/users', {
        fullName: form.fullName,
        username: form.username,
        password: form.password,
        phone: form.phone,
        email: form.email || undefined,
        roles: [form.role],
      });
      setShowModal(false);
      setForm({ fullName: '', username: '', password: '', phone: '', email: '', role: 'CASHIER' });
      setSuccess('User created successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (userId: string) => {
    try {
      await api.delete(`/api/users/${userId}/toggle`);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    CASHIER: 'bg-green-100 text-green-700',
    INVENTORY: 'bg-amber-100 text-amber-700',
    ACCOUNTANT: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{users.length} users registered</p>
        <button
          onClick={() => { setShowModal(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-medium">
          ✅ {success}
        </div>
      )}

      {/* Users Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-36">
              <div className="shimmer h-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div key={user.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${user.isActive === false ? 'opacity-60 border-gray-200' : 'border-gray-100 hover:shadow-md'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-gradient-to-br from-store-green to-store-green-light rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{user.fullName?.[0]}</span>
                </div>
                <button
                  onClick={() => handleToggle(user.id)}
                  className={`p-1.5 rounded-lg transition-colors ${user.isActive === false ? 'text-gray-400 hover:text-gray-600' : 'text-store-green hover:bg-store-green-bg'}`}
                  title={user.isActive === false ? 'Activate user' : 'Deactivate user'}
                >
                  {user.isActive === false
                    ? <ToggleLeft className="w-6 h-6" />
                    : <ToggleRight className="w-6 h-6" />}
                </button>
              </div>
              <h3 className="font-heading font-bold text-gray-800">{user.fullName}</h3>
              <p className="text-gray-500 text-sm font-mono">@{user.username}</p>
              <p className="text-gray-400 text-xs mt-1">{user.phone}</p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {user.roles?.map((role) => (
                  <span key={role} className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${roleColors[role] || 'bg-gray-100 text-gray-600'}`}>
                    <Shield className="w-3 h-3" />
                    {role}
                  </span>
                ))}
              </div>

              {user.lastLoginAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Last login: {formatDateTime(user.lastLoginAt)}
                </p>
              )}
              {user.isActive === false && (
                <p className="text-xs text-red-400 font-semibold mt-1">⛔ Deactivated</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-gray-800">Add New User</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                  <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="e.g., Ahmed Ali" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username *</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green font-mono" placeholder="ahmed.ali" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="Min 6 chars" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone *</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="0300-0000000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green" placeholder="optional" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-store-green">
                    <option value="CASHIER">🟢 Cashier — POS counter access only</option>
                    <option value="INVENTORY">🟡 Inventory — Stock management access</option>
                    <option value="ACCOUNTANT">📊 Accountant — Reports access</option>
                    <option value="MANAGER">🔵 Manager — Full store management</option>
                    <option value="ADMIN">🟣 Admin — Full system access</option>
                  </select>
                </div>
              </div>

              {/* Role info */}
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                <strong>Role Permissions:</strong>
                {form.role === 'CASHIER' && ' Can only access the POS billing counter.'}
                {form.role === 'INVENTORY' && ' Can manage products and receive goods.'}
                {form.role === 'ACCOUNTANT' && ' Can view all financial reports.'}
                {form.role === 'MANAGER' && ' Can access everything except user management.'}
                {form.role === 'ADMIN' && ' Has full access to all features including user management.'}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-3 bg-store-green text-white rounded-xl font-semibold text-sm hover:bg-store-green-dark disabled:opacity-60">
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
