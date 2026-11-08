import { Menu } from 'lucide-react';
import { Suspense, useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { setMoneyRates } from '../lib/format';
import { useUsdRate } from '../lib/queries';
import BrandMark from './BrandMark';
import PageFallback from './PageFallback';
import Sidebar from './Sidebar';

export default function Layout({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const location = useLocation();
  const { data: fx } = useUsdRate();
  setMoneyRates({
    unitSize: user?.unit_size ?? null,
    nokPerUsd: fx?.nok_per_usd ?? null,
  });

  return (
    <div className="relative min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-elevated focus:px-3 focus:py-2 focus:text-sm"
      >
        Hopp til innhold
      </a>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-background/95 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
          aria-label="Åpne meny"
          aria-expanded={menuOpen}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <BrandMark className="h-6 w-6" />
        <span className="font-heading text-[14.5px] font-semibold tracking-tight">Bet-Tracker</span>
      </header>

      <button
        type="button"
        tabIndex={-1}
        aria-label="Lukk meny"
        className={`fixed inset-0 z-40 cursor-default bg-[rgb(3_5_7/0.6)] transition-opacity duration-300 lg:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeMenu}
      />

      <Sidebar user={user} mobileOpen={menuOpen} onClose={closeMenu} />

      <main id="main" className="relative lg:pl-[232px]">
        <div className="mx-auto w-full max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <Suspense fallback={<PageFallback />}>
            <div key={location.pathname} className="animate-enter">
              <Outlet context={{ user }} />
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
