import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useJoinOrganizationMutation } from '@/hooks/use-join-organization';
import { Loader2 } from 'lucide-react';

interface JoinOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function JoinOrganizationModal({ open, onOpenChange, onSuccess }: JoinOrganizationModalProps) {
  const [code, setCode] = useState('');
  const { toast } = useToast();
  const joinMutation = useJoinOrganizationMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await joinMutation.mutateAsync(code.trim());
    if (result.success) {
      toast({
        title: 'Request sent',
        description: 'Your request has been sent to the organization admin for approval.',
      });
      setCode('');
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast({
        title: 'Could not join',
        description: result.error ?? 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join organization</DialogTitle>
          <DialogDescription>
            Enter your organization code (e.g. SW-ABCD-1234). Your request will be sent to the admin for approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">Organization code</Label>
            <Input
              id="join-code"
              placeholder="e.g. SW-ABCD-1234"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={joinMutation.isPending}
              maxLength={14}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={joinMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={joinMutation.isPending}>
              {joinMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Request to Join'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
