import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Skriv inn e-post og passord');
      return;
    }

    setSubmitting(true);

    try {
      await login(email, password);
      toast.success('Innlogget');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message === 'Login failed' ? 'Innlogging feilet' : error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[#09090B]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%)]"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-8">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center mb-2">Bet Tracker</h1>
            <p className="text-text-secondary text-center mb-8">Hold oversikt over spill og resultat</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@epost.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Passord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                />
              </div>

              <Button
                data-testid="login-btn"
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-6 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
              >
                {submitting ? 'Logger inn...' : 'Logg inn'}
              </Button>
            </form>

            <p className="text-xs text-text-muted text-center mt-6">
              Demo: e-post og passord oppretter konto automatisk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
