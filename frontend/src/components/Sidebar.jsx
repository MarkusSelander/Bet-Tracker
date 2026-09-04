import { BarChart3, Calendar, LayoutDashboard, ListChecks, LogOut, Settings, Star, TrendingUp, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Oversikt', testId: 'nav-dashboard' },
  { to: '/bets', icon: ListChecks, label: 'Spill', testId: 'nav-bets' },
  { to: '/calendar', icon: Calendar, label: 'Kalender', testId: 'nav-calendar' },
  { to: '/analytics', icon: BarChart3, label: 'Analyse', testId: 'nav-analytics' },
  { to: '/favorites', icon: Star, label: 'Favoritter', testId: 'nav-favorites' },
  { to: '/settings', icon: Settings, label: 'Innstillinger', testId: 'nav-settings' },
];

export default function Sidebar({ user, mobileOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      onClose?.();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 bg-[#0F0F10] border-r border-white/10 flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-black" />
          </div>
          <span className="text-xl font-bold">Bet Tracker</span>
        </div>
        <button type="button" className="lg:hidden p-1 text-text-secondary" onClick={onClose} aria-label="Lukk meny">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-nav-item flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'active bg-primary/10 text-primary border border-primary/20'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar>
            <AvatarImage src={user?.picture} />
            <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'Bruker'}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          data-testid="logout-btn"
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logg ut</span>
        </button>
      </div>
    </aside>
  );
}
