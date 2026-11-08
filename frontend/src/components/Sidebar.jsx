import { CalendarDays, ChartNoAxesColumn, LayoutDashboard, LogOut, Rows3, Settings, Star, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import BrandMark from './BrandMark';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const NAV_GROUPS = [
  {
    label: 'Ytelse',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Oversikt', testId: 'nav-dashboard' },
      { to: '/analytics', icon: ChartNoAxesColumn, label: 'Analyse', testId: 'nav-analytics' },
      { to: '/calendar', icon: CalendarDays, label: 'Kalender', testId: 'nav-calendar' },
    ],
  },
  {
    label: 'Spill',
    items: [
      { to: '/bets', icon: Rows3, label: 'Spill', testId: 'nav-bets' },
      { to: '/favorites', icon: Star, label: 'Favoritter', testId: 'nav-favorites' },
    ],
  },
];

const CURRENCY_LABELS = { NOK: 'NOK', USD: 'USD', UNITS: 'Units' };

function navClassName({ isActive }) {
  return cn(
    'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70',
    isActive ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/50 hover:text-text-primary'
  );
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} data-testid={item.testId} onClick={onNavigate} className={navClassName}>
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-200',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden="true"
          />
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ user, mobileOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    panelRef.current?.querySelector('a[href]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onClose]);

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
      ref={panelRef}
      aria-label="Hovedmeny"
      className={cn(
        'fixed left-0 top-0 z-50 flex h-[100dvh] w-[248px] flex-col border-r border-hairline bg-sunken',
        'transition-transform duration-300 ease-out lg:w-[232px] lg:translate-x-0',
        mobileOpen ? 'translate-x-0 shadow-popover' : '-translate-x-full'
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <NavLink
          to="/dashboard"
          onClick={onClose}
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate font-heading text-[14.5px] font-semibold leading-tight tracking-tight">
              Bet-Tracker
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              {CURRENCY_LABELS[user?.currency] || 'NOK'} · ytelse
            </span>
          </span>
        </NavLink>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary lg:hidden"
          onClick={onClose}
          aria-label="Lukk meny"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4 pt-4" aria-label="Sider">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-1.5 px-2.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-hairline p-3">
        <NavItem
          item={{ to: '/settings', icon: Settings, label: 'Innstillinger', testId: 'nav-settings' }}
          onNavigate={onClose}
        />
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <Avatar className="h-7 w-7 border border-hairline">
            <AvatarImage src={user?.picture} alt="" />
            <AvatarFallback className="bg-elevated text-[11px] font-semibold text-text-secondary">
              {user?.name?.charAt(0) || 'B'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium leading-tight">{user?.name || 'Bruker'}</p>
            <p className="truncate text-[11px] text-text-muted">{user?.email}</p>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="logout-btn"
                  type="button"
                  onClick={handleLogout}
                  aria-label="Logg ut"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Logg ut</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </aside>
  );
}
