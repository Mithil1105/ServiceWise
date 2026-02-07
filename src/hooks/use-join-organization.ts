import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type JoinOrganizationResult = { success: boolean; error: string | null };

/**
 * Client-side join by code: find org by join_code (SW-XXXX-XXXX), insert pending membership.
 * No Edge Function; RLS allows SELECT on active orgs and INSERT with status=pending.
 */
export async function joinOrganization(code: string): Promise<JoinOrganizationResult> {
  const normalized = code.trim().toUpperCase().replace(/\s/g, '');
  if (!normalized || !/^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
    return { success: false, error: 'Enter a valid code (e.g. SW-ABCD-1234)' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: org, error: findError } = await supabase
    .from('organizations')
    .select('id, name, status')
    .eq('join_code', normalized)
    .eq('status', 'active')
    .maybeSingle();

  if (findError) return { success: false, error: findError.message };
  if (!org) return { success: false, error: 'Organization not found or inactive' };

  const { data: existing } = await supabase
    .from('organization_members')
    .select('status')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'pending') return { success: false, error: 'Already requested to join this organization' };
    if (existing.status === 'active') return { success: false, error: 'Already a member of this organization' };
    return { success: false, error: 'Your request was declined' };
  }

  const { error: insertError } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'supervisor',
    status: 'pending',
  });

  if (insertError) return { success: false, error: insertError.message };
  return { success: true, error: null };
}

/** Pending join requests for the current user (no org yet or has org) */
export function useMyPendingJoinRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['organization_members', 'my-pending', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('organization_members')
        .select('id, organization_id, status, created_at, organizations(name, join_code)')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useJoinOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinOrganization(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
    },
  });
}

export type PendingJoinRequest = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  name: string | null;
};

/** Pending join requests for an org (org admins only) */
export function usePendingJoinRequests(orgId: string | null) {
  return useQuery({
    queryKey: ['organization_members', 'pending', orgId],
    queryFn: async (): Promise<PendingJoinRequest[]> => {
      if (!orgId) return [];
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role, status, created_at')
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (membersError) throw membersError;
      if (!members?.length) return [];
      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);
      const nameByUserId = new Map((profiles ?? []).map((p) => [p.id, p.name]));
      return members.map((m) => ({
        ...m,
        name: nameByUserId.get(m.user_id) ?? null,
      }));
    },
    enabled: !!orgId,
  });
}
