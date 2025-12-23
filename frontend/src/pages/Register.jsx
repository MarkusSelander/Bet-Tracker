import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { user, loading, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Show loader while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to dashboard only when loading is done AND user exists
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast.error('Vennligst fyll ut alle felt');
      return;
    }

    if (password.length < 8) {
      toast.error('Passordet må være minst 8 tegn');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passordene stemmer ikke overens');
      return;
    }

    setSubmitting(true);

    try {
      await register(email, password, name || undefined);
      toast.success('Konto opprettet!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registrering feilet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1608154119029-53f3c6ad12e4?crop=entropy&cs=srgb&fm=jpg&q=85)',
        }}
      >
        <div className="absolute inset-0 bg-black/80"></div>
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
            <p className="text-text-secondary text-center mb-8">Opprett en konto for å komme i gang</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn (valgfritt)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ditt navn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minst 8 tegn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                  required
                  minLength={8}
                />
                <p className="text-xs text-text-muted">Passordet må være minst 8 tegn langt</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bekreft passord</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Gjenta passordet"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-black/20 border-white/10"
                  disabled={submitting}
                  required
                />
              </div>

              <Button
                data-testid="register-btn"
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-6 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
              >
                {submitting ? 'Oppretter konto...' : 'Opprett konto'}
              </Button>
            </form>

            <p className="text-xs text-text-muted text-center mt-6">
              Har du allerede en konto?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Logg inn
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
