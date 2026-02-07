import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function AdminOrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ['admin-org', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, status, join_code, created_at')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['admin-org-members', id],
    queryFn: async () => {
      if (!id) return [];
      const { data: rows, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, status, created_at')
        .eq('organization_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
      if (userIds.length === 0) return rows ?? [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
      return (rows ?? []).map((r: { user_id: string; [k: string]: unknown }) => ({
        ...r,
        displayName: profileMap.get(r.user_id) ?? r.user_id,
      }));
    },
    enabled: !!id,
  });

  const copyJoinCode = () => {
    if (org?.join_code) {
      navigator.clipboard.writeText(org.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!id) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-muted-foreground">Missing organization ID.</p>
        <Button variant="link" asChild><Link to="/admin/organizations">Back to list</Link></Button>
      </div>
    );
  }

  if (isLoading || !org) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/organizations">← Organizations</Link>
        </Button>
      </div>
      <div className="flex items-start gap-4 mb-6">
        <Building2 className="h-10 w-10 text-muted-foreground shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-muted-foreground">Slug: {org.slug} · Status: {org.status}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-1">Join code</p>
        <div className="flex items-center gap-2">
          <code className="text-lg font-mono bg-muted px-2 py-1 rounded">{org.join_code ?? '—'}</code>
          <Button variant="outline" size="sm" onClick={copyJoinCode}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Users can join this organization by entering this code in the &quot;Join Organization&quot; flow.
        </p>
      </div>

      <h2 className="text-lg font-semibold mb-3">Members</h2>
      {members.length === 0 ? (
        <p className="text-muted-foreground">No members yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: { id: string; user_id: string; role: string; status: string; created_at: string; displayName?: string }) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{m.displayName ?? m.user_id}</td>
                  <td className="p-3">{m.role}</td>
                  <td className="p-3">{m.status}</td>
                  <td className="p-3">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
