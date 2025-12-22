import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout({ user }) {
  return (
    <div className="flex min-h-screen relative">
      <Sidebar user={user} />
      <main className="flex-1 ml-64 p-8 relative z-0">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
