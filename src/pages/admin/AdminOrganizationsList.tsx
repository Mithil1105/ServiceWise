import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthed } from '@/lib/functions-invoke';
import { formatDateTimeDMY } from '@/lib/date';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function AdminOrganizationsList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, status, join_code, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: contactRequests = [],
    isLoading: contactRequestsLoading,
    error: contactRequestsError,
  } = useQuery({
    queryKey: ['admin-contact-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('id, company_name, fleet_size, city, contact_person, phone, email, message, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (orgName: string) => {
      const payload = await invokeAuthed<{ organizationId: string; joinCode: string }>(
        'admin-create-organization',
        { name: orgName }
      );
      return payload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orgs-count'] });
      setCreateOpen(false);
      setName('');
      setCreateError(null);
      navigate(`/admin/organizations/${data.organizationId}?joinCode=${encodeURIComponent(data.joinCode)}`);
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Failed to create organization');
    },
  });

  const handleCreate = () => {
    const trimmed = name?.trim();
    if (!trimmed) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    createMutation.mutate(trimmed);
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                You will be added as the organization admin. A join code (SW-XXXX-XXXX) will be generated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-muted-foreground">No organizations yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {orgs.map((org) => (
            <li key={org.id}>
              <Link
                to={`/admin/organizations/${org.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{org.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Join code: {org.join_code ?? '—'} · {org.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 border-t pt-8">
        <h2 className="text-xl font-semibold mb-2">Contact requests</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Leads submitted from the public Contact page appear here for master admin follow-up.
        </p>

        {contactRequestsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading contact requests…
          </div>
        ) : contactRequestsError ? (
          <p className="text-sm text-destructive">Could not load contact requests.</p>
        ) : contactRequests.length === 0 ? (
          <p className="text-muted-foreground">No contact requests yet.</p>
        ) : (
          <div className="space-y-3">
            {contactRequests.map((request) => (
              <div key={request.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{request.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.contact_person} · {request.city || 'City not provided'} · Fleet: {request.fleet_size || 'Not provided'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTimeDMY(request.created_at)}
                  </p>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  <a href={`mailto:${request.email}`} className="hover:underline text-foreground">
                    {request.email}
                  </a>
                  {' · '}
                  <a href={`tel:${request.phone}`} className="hover:underline text-foreground">
                    {request.phone}
                  </a>
                  {' · '}
                  <span className="uppercase">{request.status}</span>
                </div>
                {request.message && (
                  <p className="mt-3 text-sm">{request.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
