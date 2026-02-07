/**
 * Phase 6: Email verification for self-serve signups.
 *
 * Supabase Auth settings (document in Dashboard):
 * - Auth → Providers → Email: Enable "Confirm email" for self-serve users.
 * - Ensure SMTP is configured so verification emails send reliably (no SMTP in code).
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function VerifyEmail() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const emailConfirmed = !!user?.email_confirmed_at;

  // Redirect when email is confirmed – do this in useEffect to avoid "setState during render"
  useEffect(() => {
    if (!loading && user && emailConfirmed) {
      navigate(profile?.organization_id ? '/app' : '/onboarding', { replace: true });
    }
  }, [loading, user, emailConfirmed, profile?.organization_id, navigate]);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) throw error;
      toast({
        title: 'Verification email sent',
        description: 'Check your inbox and spam folder.',
      });
    } catch (e: unknown) {
      toast({
        title: 'Could not resend',
        description: e instanceof Error ? e.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  const handleVerified = async () => {
    setChecking(true);
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (session?.user?.email_confirmed_at) {
        toast({ title: 'Email verified!', description: 'Taking you to the app.' });
        const hasOrg = !!profile?.organization_id;
        navigate(hasOrg ? '/app' : '/onboarding');
        return;
      }
      toast({
        title: 'Not verified yet',
        description: 'Click the link in the email we sent, then click "I\'ve verified" again.',
        variant: 'destructive',
      });
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Please log in to verify your email.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/auth">Go to sign in</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (emailConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <div className="text-center mb-6">
          <img src="/SWlogo.png" alt="ServiceWise" className="h-14 w-auto mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Check your inbox
            </CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{user.email}</strong>. Click the link in that email to verify your account.
              If you don&apos;t see it, check your spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend verification email'}
            </Button>
            <Button
              className="w-full gap-2"
              onClick={handleVerified}
              disabled={checking}
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              I&apos;ve verified
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
