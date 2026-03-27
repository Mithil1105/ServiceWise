import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useOrganizationSettings } from '@/hooks/use-organization-settings';
import { useSupervisors } from '@/hooks/use-car-assignments';
import {
  useEnsurePrivateProject,
  useProjectPoolOverview,
  useProjectsAdminOverview,
  useSetOpenProjectSupervisor,
  useTransferCarToProject,
} from '@/hooks/use-projects';

export default function Projects() {
  const { user, isAdmin, isManager, isSupervisor } = useAuth();
  const canManage = isAdmin || isManager;
  const canUsePool = isSupervisor || canManage;
  const { data: orgSettings } = useOrganizationSettings();
  const supervisorMode = (orgSettings?.supervisor_assignment_mode ?? 'project') as 'project' | 'legacy';
  const [openSupervisorId, setOpenSupervisorId] = useState<string>('');
  const [privateSupervisorId, setPrivateSupervisorId] = useState<string>('');
  const [supervisorProjectName, setSupervisorProjectName] = useState('');
  const [search, setSearch] = useState('');
  const [targetProjectByCar, setTargetProjectByCar] = useState<Record<string, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const { data: supervisors = [] } = useSupervisors();
  const { data: adminRows = [] } = useProjectsAdminOverview();
  const { data: pool } = useProjectPoolOverview();
  const setOpenSupervisor = useSetOpenProjectSupervisor();
  const ensurePrivateProject = useEnsurePrivateProject();
  const transferCar = useTransferCarToProject();

  const openRows = useMemo(() => adminRows.filter((r) => r.project_type === 'open'), [adminRows]);
  const privateRows = useMemo(() => adminRows.filter((r) => r.project_type === 'private'), [adminRows]);
  const myAssignedProjects = useMemo(
    () => adminRows.filter((r) => r.supervisor_id === user?.id),
    [adminRows, user?.id]
  );
  const myPrivateProjects = useMemo(
    () => myAssignedProjects.filter((r) => r.project_type === 'private'),
    [myAssignedProjects]
  );
  const myCarsByProject = useMemo(() => {
    const grouped: Record<string, { car_id: string; vehicle_number: string; model: string; brand: string | null }[]> = {};
    for (const car of pool?.cars ?? []) {
      const isMyPrivateScope = car.car_project_scope === 'mine_private' || car.car_project_scope === 'private';
      if (!isMyPrivateScope) continue;
      const projectId = car.car_project_id ?? pool?.my_project_ids?.[0] ?? null;
      if (!projectId) continue;
      if (!grouped[projectId]) grouped[projectId] = [];
      grouped[projectId].push({
        car_id: car.car_id,
        vehicle_number: car.vehicle_number,
        model: car.model,
        brand: car.brand,
      });
    }
    return grouped;
  }, [pool?.cars]);
  const openCars = useMemo(
    () => (pool?.cars ?? []).filter((c) => c.car_project_scope === 'open')
      .filter((c) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${c.vehicle_number} ${c.brand ?? ''} ${c.model}`.toLowerCase().includes(q);
      }),
    [pool?.cars, search]
  );
  const myProjectCars = useMemo(
    () => (pool?.cars ?? []).filter((c) => c.car_project_scope === 'mine_private' || c.car_project_scope === 'private')
      .filter((c) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${c.vehicle_number} ${c.brand ?? ''} ${c.model}`.toLowerCase().includes(q);
      }),
    [pool?.cars, search]
  );

  if (!canUsePool) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You do not have access to projects.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (supervisorMode === 'legacy') {
    return (
      <div className="w-full min-w-0 p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects (Disabled in Legacy Mode)</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2">
            <p>
              Supervisor assignment mode is set to <span className="font-medium">Legacy</span>.
              Projects and open-pool transfers are disabled.
            </p>
            <p>
              Switch to <span className="font-medium">Project Mode</span> in Settings → Bookings to use this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Open project is shared; each supervisor has one private project.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Admin Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Open project supervisor (handles all bookings)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    value={openSupervisorId}
                    onValueChange={setOpenSupervisorId}
                    options={supervisors.map((s) => ({ value: s.id, label: s.name }))}
                    placeholder="Select supervisor"
                    searchPlaceholder="Search supervisor..."
                    emptyText="No supervisor found"
                  />
                </div>
                <Button
                  onClick={() => openSupervisorId && setOpenSupervisor.mutate({ supervisorId: openSupervisorId })}
                  disabled={!openSupervisorId || setOpenSupervisor.isPending}
                >
                  Set Open Supervisor
                </Button>
              </div>
              {openRows[0] && (
                <p className="text-sm text-muted-foreground">
                  Current: <span className="font-medium">{openRows[0].supervisor_name ?? 'Not set'}</span>
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Create/ensure private project for supervisor</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <SearchableSelect
                  value={privateSupervisorId}
                  onValueChange={setPrivateSupervisorId}
                  options={supervisors.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder="Select supervisor"
                  searchPlaceholder="Search supervisor..."
                  emptyText="No supervisor found"
                />
                <Input
                  placeholder="Project name"
                  value={supervisorProjectName}
                  onChange={(e) => setSupervisorProjectName(e.target.value)}
                />
                <Button
                  onClick={() => {
                    const trimmedName = supervisorProjectName.trim();
                    if (!privateSupervisorId || !trimmedName) return;
                    ensurePrivateProject.mutate({ supervisorId: privateSupervisorId, name: trimmedName });
                  }}
                  disabled={!privateSupervisorId || !supervisorProjectName.trim() || ensurePrivateProject.isPending}
                >
                  Ensure Project
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Projects Overview</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {openRows.map((r) => (
                  <Card key={r.project_id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{r.project_name}</p>
                        <Badge>OPEN</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Supervisor: {r.supervisor_name ?? 'Not set'}</p>
                      <p className="text-sm text-muted-foreground">Cars: {r.car_count}</p>
                    </CardContent>
                  </Card>
                ))}
                {privateRows.map((r) => (
                  <Card key={r.project_id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{r.project_name}</p>
                        <Badge variant="secondary">PRIVATE</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Supervisor: {r.supervisor_name ?? 'Not set'}</p>
                      <p className="text-sm text-muted-foreground">Cars: {r.car_count}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isSupervisor && (
        <Card>
          <CardHeader>
            <CardTitle>My Assigned Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myAssignedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects assigned to you.</p>
            ) : (
              myAssignedProjects.map((project) => (
                <div key={project.project_id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{project.project_name}</p>
                      <p className="text-sm text-muted-foreground">Cars: {project.car_count}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedProjects((prev) => ({ ...prev, [project.project_id]: !prev[project.project_id] }))
                        }
                      >
                        {expandedProjects[project.project_id] ? 'Hide Cars' : 'Show Cars'}
                      </Button>
                      <Badge variant={project.project_type === 'open' ? 'default' : 'secondary'}>
                        {project.project_type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {expandedProjects[project.project_id] && (
                    <div className="space-y-2 border-t pt-2">
                      {(myCarsByProject[project.project_id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No cars currently assigned.</p>
                      ) : (
                        (myCarsByProject[project.project_id] ?? []).map((car) => (
                          <div key={car.car_id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                            <p className="text-sm font-medium">{car.vehicle_number}</p>
                            <p className="text-xs text-muted-foreground">{car.brand ?? ''} {car.model}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Car Pool Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by vehicle/model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Open Project Cars</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {openCars.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open project cars.</p>
                ) : openCars.map((car) => (
                  <div key={car.car_id} className="border rounded-md p-2 space-y-2">
                    <div>
                      <p className="font-medium">{car.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground">{car.brand ?? ''} {car.model}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                      <SearchableSelect
                        value={targetProjectByCar[car.car_id] ?? ''}
                        onValueChange={(value) =>
                          setTargetProjectByCar((prev) => ({ ...prev, [car.car_id]: value }))
                        }
                        options={myPrivateProjects.map((p) => ({ value: p.project_id, label: p.project_name }))}
                        placeholder="Select target project"
                        searchPlaceholder="Search project..."
                        emptyText="No project found"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const targetProjectId = targetProjectByCar[car.car_id];
                          if (!targetProjectId) return;
                          transferCar.mutate({ carId: car.car_id, targetProjectId });
                        }}
                        disabled={!targetProjectByCar[car.car_id] || transferCar.isPending}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Cars in My Projects (for transfer)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {myProjectCars.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cars in your assigned projects.</p>
                ) : myProjectCars.map((car) => (
                  <div key={car.car_id} className="border rounded-md p-2 space-y-2">
                    <div>
                      <p className="font-medium">{car.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground">{car.brand ?? ''} {car.model}</p>
                      <p className="text-xs text-muted-foreground">Current project: {car.car_project_name ?? 'Unknown'}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                      <SearchableSelect
                        value={targetProjectByCar[car.car_id] ?? ''}
                        onValueChange={(value) =>
                          setTargetProjectByCar((prev) => ({ ...prev, [car.car_id]: value }))
                        }
                        options={[
                          { value: pool?.open_project_id ?? '', label: `${pool?.open_project_name ?? 'Open'} (Open)` },
                          ...myPrivateProjects
                            .filter((p) => p.project_id !== (car.car_project_id ?? pool?.my_project_ids?.[0] ?? null))
                            .map((p) => ({ value: p.project_id, label: p.project_name })),
                        ].filter((o) => !!o.value)}
                        placeholder="Select destination project"
                        searchPlaceholder="Search project..."
                        emptyText="No project found"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const targetProjectId = targetProjectByCar[car.car_id];
                          const currentProjectId = car.car_project_id ?? pool?.my_project_ids?.[0] ?? null;
                          if (!targetProjectId || targetProjectId === currentProjectId) return;
                          transferCar.mutate({ carId: car.car_id, targetProjectId });
                        }}
                        disabled={!targetProjectByCar[car.car_id] || targetProjectByCar[car.car_id] === (car.car_project_id ?? pool?.my_project_ids?.[0] ?? null) || transferCar.isPending}
                      >
                        Move
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
