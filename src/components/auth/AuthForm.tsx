import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log(`Attempting to ${mode} with:`, { email });

    try {
      const result = mode === 'login' 
        ? await signIn(email, password)
        : await signUp(email, password);
      
      console.log(`${mode} result:`, result);
      
      if (result.error) {
        console.error(`${mode} error:`, result.error);
        throw result.error;
      }
      
      console.log(`${mode} successful, redirecting...`);
      // Redirect to home page after successful authentication
      navigate('/');
      
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">
          {mode === 'login' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-muted-foreground">
          {mode === 'login' 
            ? 'Sign in to continue to Mood Map'
            : 'Create an account to get started'}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === 'login' && (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => setMode('signup')}
              >
                Need an account?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : mode === 'login' ? (
            'Sign In'
          ) : (
            'Sign Up'
          )}
        </Button>

        {mode === 'signup' && (
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
