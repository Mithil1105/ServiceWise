import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminHome() {
  const { data: orgCount = 0 } = useQuery({
    queryKey: ['admin-orgs-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-2xl font-semibold mb-2">Admin</h1>
      <p className="text-muted-foreground mb-6">
        As a master admin you can create and manage organizations. New organizations get a join code (SW-XXXX-XXXX) for members to request access.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Organizations</p>
              <p className="text-2xl font-semibold">{orgCount}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/admin/organizations" className="gap-2">
                <Plus className="h-4 w-4" />
                Create organization
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/organizations">View all</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
