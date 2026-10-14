import { AlertCircle, Eye, EyeOff, Loader2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth, warmUpBackend } from '../contexts/AuthContext';
import { MIN_PASSWORD_LENGTH, validateLogin, validateRegister } from '../lib/authForm';

const LOGIN = 'login';
const REGISTER = 'register';
const FIELD_CLASS = 'h-11 bg-black/20 border-white/10';

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`${FIELD_CLASS} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Skjul passord' : 'Vis passord'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:text-text-primary"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
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

function SubmitButton({ submitting, idle, busy, testId }) {
  return (
    <Button
      data-testid={testId}
      type="submit"
      disabled={submitting}
      aria-busy={submitting}
      className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
    >
      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {submitting ? busy : idle}
    </Button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, register } = useAuth();
  const mode = location.pathname === '/register' ? REGISTER : LOGIN;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    warmUpBackend();
  }, []);

  if (user) {
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }

  const edit = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError('');
  };

  const switchMode = (next) => {
    if (next === mode) return;
    setError('');
    setPassword('');
    setConfirm('');
    navigate(next === REGISTER ? '/register' : '/login', { replace: true, state: location.state });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const validationError =
      mode === REGISTER ? validateRegister({ name, email, password, confirm }) : validateLogin({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      if (mode === REGISTER) {
        await register({ name, email, password });
        toast.success('Bruker opprettet');
      } else {
        await login(email, password);
        toast.success('Innlogget');
      }
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Noe gikk galt. Prøv igjen.');
    } finally {
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
            <p className="text-text-secondary text-center mb-6">
              {mode === REGISTER ? 'Opprett en konto for å komme i gang' : 'Hold oversikt over spill og resultat'}
            </p>

            <Tabs value={mode} onValueChange={switchMode}>
              <TabsList className="grid w-full grid-cols-2 h-11 bg-white/5 mb-6">
                <TabsTrigger value={LOGIN} className="h-9 data-[state=active]:bg-white/10">
                  Logg inn
                </TabsTrigger>
                <TabsTrigger value={REGISTER} className="h-9 data-[state=active]:bg-white/10">
                  Registrer bruker
                </TabsTrigger>
              </TabsList>

              <TabsContent value={LOGIN} className="mt-0">
                <form onSubmit={submit} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-post</Label>
                    <Input
                      id="login-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="din@epost.no"
                      value={email}
                      onChange={edit(setEmail)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passord</Label>
                    <PasswordInput
                      id="login-password"
                      autoComplete="current-password"
                      placeholder="Passord"
                      value={password}
                      onChange={edit(setPassword)}
                    />
                  </div>
                  <FormError message={mode === LOGIN ? error : ''} />
                  <SubmitButton submitting={submitting} idle="Logg inn" busy="Logger inn..." testId="login-btn" />
                </form>
              </TabsContent>

              <TabsContent value={REGISTER} className="mt-0">
                <form onSubmit={submit} noValidate className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">
                      Navn <span className="text-text-muted font-normal">(valgfritt)</span>
                    </Label>
                    <Input
                      id="register-name"
                      autoComplete="name"
                      placeholder="Ola Nordmann"
                      value={name}
                      onChange={edit(setName)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-post</Label>
                    <Input
                      id="register-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="din@epost.no"
                      value={email}
                      onChange={edit(setEmail)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Passord</Label>
                    <PasswordInput
                      id="register-password"
                      autoComplete="new-password"
                      placeholder={`Minst ${MIN_PASSWORD_LENGTH} tegn`}
                      value={password}
                      onChange={edit(setPassword)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Bekreft passord</Label>
                    <PasswordInput
                      id="register-confirm"
                      autoComplete="new-password"
                      placeholder="Skriv passordet på nytt"
                      value={confirm}
                      onChange={edit(setConfirm)}
                    />
                  </div>
                  <FormError message={mode === REGISTER ? error : ''} />
                  <SubmitButton
                    submitting={submitting}
                    idle="Opprett bruker"
                    busy="Oppretter bruker..."
                    testId="register-btn"
                  />
                </form>
              </TabsContent>
            </Tabs>

            <p className="text-sm text-text-muted text-center mt-6">
              {mode === REGISTER ? 'Har du allerede en konto? ' : 'Ny her? '}
              <button
                type="button"
                onClick={() => switchMode(mode === REGISTER ? LOGIN : REGISTER)}
                className="text-primary hover:underline font-medium"
              >
                {mode === REGISTER ? 'Logg inn' : 'Registrer bruker'}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
