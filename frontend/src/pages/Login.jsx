import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'BUYER') {
      setForm({ email: 'buyer@gocomet.com', password: 'password123' });
    } else {
      setForm({ email: 'supplier1@gocomet.com', password: 'password123' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white font-extrabold text-2xl shadow-lg mb-3">
            GC
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            GoComet RFQ Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            British Auction Reverse Bidding Platform
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-lg border border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">Sign In</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fillDemo('BUYER')}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium px-2 py-1 rounded transition"
              >
                Demo Buyer
              </button>
              <button
                type="button"
                onClick={() => fillDemo('SUPPLIER')}
                className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium px-2 py-1 rounded transition"
              >
                Demo Supplier
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 text-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-gray-500 border-t border-gray-100 pt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-bold hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
