import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative">
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-white/10 bg-[#09090B]">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="p-1 text-text-secondary hover:text-white"
          aria-label="Åpne meny"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold">Bet Tracker</span>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          aria-label="Lukk meny"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Sidebar user={user} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="lg:ml-64 p-4 lg:p-8 relative z-0">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
