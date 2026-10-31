import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SUPPLIER',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Registration successful!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
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
            Create an Account
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Join the GoComet British Auction System
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-lg border border-gray-100 bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Company / User Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., DHL Global Forwarding"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

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
                minLength={6}
              />
            </div>

            <div>
              <label className="label">Account Role</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'SUPPLIER' })}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    form.role === 'SUPPLIER'
                      ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                  }`}
                >
                  <span className="text-sm font-bold">🚚 Supplier</span>
                  <span className="text-[11px] text-gray-500">Submit competitive quotes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'BUYER' })}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    form.role === 'BUYER'
                      ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                  }`}
                >
                  <span className="text-sm font-bold">🏢 Buyer</span>
                  <span className="text-[11px] text-gray-500">Post RFQs & manage auctions</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 text-sm"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-gray-500 border-t border-gray-100 pt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
