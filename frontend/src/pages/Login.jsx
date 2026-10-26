import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { AlertCircle, Loader2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useAuth, warmUpBackend } from '../contexts/AuthContext';
import { googleAuthError } from '../lib/authForm';
import { preloadDashboard } from '../lib/dashboardLoader';
import { getFirebaseAuth, isFirebaseReady } from '../lib/firebase';

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginWithGoogle } = useAuth();
  const configured = isFirebaseReady();
  const [error, setError] = useState(configured ? '' : 'Firebase er ikke satt opp i dette bygget.');
  const [submitting, setSubmitting] = useState(false);
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    warmUpBackend();
    preloadDashboard();
  }, []);

  if (user) {
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }

  const signIn = async () => {
    if (submitting) return;
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase er ikke satt opp i dette bygget.');
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setError('');
    setSubmitting(true);
    const warmingTimer = setTimeout(() => setWarming(true), 3000);
    try {
      const result = await signInWithPopup(auth, provider);
      clearTimeout(warmingTimer);
      await loginWithGoogle(result.user, { force: true });
      toast.success('Innlogget');
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setError(googleAuthError(redirectError));
        }
      } else {
        setError(err?.code ? googleAuthError(err) : err.message || 'Noe gikk galt. Prøv igjen.');
      }
      clearTimeout(warmingTimer);
      setWarming(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[#09090B]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%)]"></div>
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.35)]">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center mb-2">Bet Tracker</h1>
            <p className="text-text-secondary text-center mb-6">Hold oversikt over spill og resultat</p>

            <div className="space-y-4">
              <Button
                data-testid="google-login-btn"
                type="button"
                onClick={signIn}
                disabled={submitting || !configured}
                aria-busy={submitting}
                className="h-11 w-full bg-white font-semibold text-black hover:bg-white/90"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                {submitting ? 'Logger inn...' : 'Fortsett med Google'}
              </Button>
              <FormError message={error} />
              {warming ? (
                <p role="status" className="text-center text-sm text-text-secondary" data-testid="auth-warming">
                  Vekker serveren, første innlogging kan ta litt tid…
                </p>
              ) : null}
              <p className="text-center text-sm">
                <Link to="/personvern" className="text-text-secondary underline" data-testid="privacy-link">
                  Personvern
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
