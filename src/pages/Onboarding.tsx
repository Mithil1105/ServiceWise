import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { joinOrganization } from '@/hooks/use-join-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ArrowLeft, LogOut } from 'lucide-react';

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const prefilledCode = searchParams.get('orgCode') ?? '';
  const [joinCode, setJoinCode] = useState(prefilledCode);
  const [joinLoading, setJoinLoading] = useState(false);
  const [success, setSuccess] = useState<{
    type: 'join_request' | 'join';
    orgName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (user && !(user as { email_confirmed_at?: string | null }).email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = joinCode.trim().toUpperCase().replace(/\s/g, '');
    if (!normalized || !/^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      toast({ title: 'Enter a valid organization code (e.g. SW-ABCD-1234)', variant: 'destructive' });
      return;
    }
    setJoinLoading(true);
    try {
      const result = await joinOrganization(normalized);
      if (!result.success) {
        toast({ title: 'Could not join', description: result.error ?? 'Something went wrong', variant: 'destructive' });
        return;
      }
      setSuccess({ type: 'join_request', orgName: '' });
    } finally {
      setJoinLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (profile?.organization_id) {
    return <Navigate to="/app" replace />;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Request sent</CardTitle>
            <CardDescription>
              Your request has been sent to the organization admin for approval. You can close this page or log out;
              when approved, you&apos;ll be able to sign in and access the organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => setSuccess(null)}>
              Join another organization
            </Button>
            <Button className="w-full" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
        <div className="text-center">
          <img src="/SWlogo.png" alt="ServiceWise" className="h-14 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold">Welcome to ServiceWise</h1>
          <p className="text-muted-foreground mt-1">Join your organization using the code provided by your admin.</p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Join your organization
            </CardTitle>
            <CardDescription>Enter your organization code (e.g. SW-ABCD-1234). Your request will be sent to the admin for approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <Label htmlFor="join-code">Organization code</Label>
                <Input
                  id="join-code"
                  placeholder="e.g. SW-ABCD-1234"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={14}
                  className="font-mono"
                />
              </div>
              <Button type="submit" className="w-full" disabled={joinLoading}>
                {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request to Join'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
