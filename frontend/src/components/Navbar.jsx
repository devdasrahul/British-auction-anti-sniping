import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const isBuyer = user?.role === 'BUYER';

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Platform Name */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition">
              GC
            </div>
            <div>
              <span className="font-black text-base text-gray-900 tracking-tight block leading-none">
                GoComet RFQ
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">
                British Auction Platform
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                location.pathname === '/'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Auctions Dashboard
            </Link>

            {isBuyer && (
              <Link
                to="/rfq/create"
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                  location.pathname === '/rfq/create'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }`}
              >
                <span>+</span>
                <span>New RFQ</span>
              </Link>
            )}
          </div>

          {/* Right Side Account & Live Signal */}
          <div className="flex items-center gap-4">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-emerald-400 animate-ping' : 'bg-gray-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              </span>
              <span className="text-[11px] font-bold text-gray-600">
                {connected ? 'Live Sync' : 'Reconnecting'}
              </span>
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                {initials}
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-xs font-extrabold text-gray-900 leading-tight">{user?.name}</p>
                <span
                  className={`inline-block text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded mt-0.5 ${
                    isBuyer ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {user?.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl border border-gray-200 hover:border-red-200 transition"
                title="Log out"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
