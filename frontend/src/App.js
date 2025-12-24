import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import AnalyticsPage from './pages/AnalyticsPage';
import BetsPage from './pages/BetsPage';
import BookmakersPage from './pages/BookmakersPage';
import CalendarPage from './pages/CalendarPage';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import SettingsPage from './pages/SettingsPage';
import TeamsPage from './pages/TeamsPage';
import TipstersPage from './pages/TipstersPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/tipsters" element={<TipstersPage />} />
            <Route path="/bookmakers" element={<BookmakersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
