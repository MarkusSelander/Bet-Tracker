import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import AnalyticsPage from './pages/AnalyticsPage';
import BetsPage from './pages/BetsPage';
import BookmakersPage from './pages/BookmakersPage';
import CalendarPage from './pages/CalendarPage';
import Dashboard from './pages/Dashboard';
import FavoritesPage from './pages/FavoritesPage';
import Login from './pages/Login';
import SettingsPage from './pages/SettingsPage';
import TipstersPage from './pages/TipstersPage';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bets" element={<BetsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/tipsters" element={<TipstersPage />} />
          <Route path="/bookmakers" element={<BookmakersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
