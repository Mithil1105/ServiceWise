import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

/** Home page: enter org code to join. Redirects to /auth or /onboarding with code. */
export function OrgCodeCard() {
  const [code, setCode] = useState('');
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\D/g, '').slice(0, 7);
    if (!clean || clean.length < 6) return;
    if (!user) {
      navigate(`/auth?orgCode=${clean}`);
      return;
    }
    if (profile?.organization_id) {
      navigate('/app');
      return;
    }
    navigate(`/onboarding?orgCode=${clean}`);
  };

  return (
    <section className="section-padding bg-muted/30">
      <div className="section-container">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enter your company code to join
            </CardTitle>
            <CardDescription>
              Have a code from your admin? Enter it below to join your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="org-code" className="sr-only">
                  Organization code
                </Label>
                <Input
                  id="org-code"
                  placeholder="e.g. 5839201"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  maxLength={7}
                />
              </div>
              <Button type="submit">Join</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
