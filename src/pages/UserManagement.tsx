import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCars } from '@/hooks/use-cars';
import {
  useCarAssignments,
  useSupervisors,
  useAssignCarToSupervisor,
  useUnassignCarFromSupervisor,
} from '@/hooks/use-car-assignments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Users,
  Search,
  Loader2,
  UserCheck,
  UserX,
  UserPlus,
  Car,
  X,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateDMY } from '@/lib/date';
import type { AppRole, Profile } from '@/types';

interface UserWithRole extends Profile {
  role?: AppRole | null;
  email?: string;
}

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: AppRole | 'none';
}

function useUsersWithRoles() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: userRole?.role as AppRole | null,
        };
      });

      return usersWithRoles;
    },
  });
}

function useAssignRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole | 'none' }) => {
      if (role === 'none') {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role });

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userData: Omit<NewUserForm, 'role'> & { role?: AppRole }) => {
      // Get current session
      let { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      // If session is expired or about to expire, refresh it
      if (sessionData.session) {
        const expiresAt = sessionData.session.expires_at;
        const now = Math.floor(Date.now() / 1000);

        // Refresh if token expires in less than 60 seconds
        if (expiresAt && expiresAt - now < 60) {
          console.log('Token expiring soon, refreshing...');
          const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Refresh error:', refreshError);
            throw new Error('Session expired. Please log out and log back in.');
          }
          sessionData = refreshedSession;
        }
      }

      const token = sessionData.session?.access_token;

      if (!token) {
        console.error('No access token found');
        throw new Error('Not authenticated. Please log out and log back in.');
      }

      console.log('Token available:', token ? 'Yes' : 'No');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL is not configured');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-user-v3`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify(userData),
        }
      );

      // Handle non-JSON responses
      let result;
      try {
        result = await response.json();
      } catch (e) {
        // If response isn't JSON, it might be an HTML error page
        const text = await response.text();
        console.error('Create user error (non-JSON):', { status: response.status, text });
        throw new Error(`Failed to create user (${response.status}). Is the edge function deployed?`);
      }

      if (!response.ok) {
        // Provide more detailed error message
        const errorMessage = result.error || `Failed to create user (${response.status})`;
        console.error('Create user error:', {
          status: response.status,
          statusText: response.statusText,
          result,
          url: `${supabaseUrl}/functions/v1/create-user`
        });

        // More helpful error messages
        if (response.status === 401) {
          throw new Error('Unauthorized. Please check: 1) You are logged in as admin, 2) Edge function is deployed');
        } else if (response.status === 404) {
          throw new Error('Edge function not found. Please deploy the create-user function first.');
        }

        throw new Error(errorMessage);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      toast({
        title: 'User created',
        description: 'New user has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export default function UserManagement() {
  const { isAdmin, user } = useAuth();
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedCar, setSelectedCar] = useState('');
  const [newUser, setNewUser] = useState<NewUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'none',
  });
  const [showPassword, setShowPassword] = useState(false);

  const { data: users, isLoading } = useUsersWithRoles();
  const { data: cars } = useCars();
  const { data: assignments, isLoading: assignmentsLoading } = useCarAssignments();
  const { data: supervisors } = useSupervisors();
  const assignRole = useAssignRole();
  const createUser = useCreateUser();
  const assignCar = useAssignCarToSupervisor();
  const unassignCar = useUnassignCarFromSupervisor();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground mb-4">
          Only administrators can manage users.
        </p>
        <Button asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const filteredUsers = users?.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = (userId: string, newRole: string) => {
    assignRole.mutate({ userId, role: newRole as AppRole | 'none' });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const userData: Omit<NewUserForm, 'role'> & { role?: AppRole } = {
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
    };

    if (newUser.role !== 'none') {
      userData.role = newUser.role as AppRole;
    }

    createUser.mutate(userData, {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'none' });
        setShowPassword(false);
      },
    });
  };

  const handleAssignCar = () => {
    if (!selectedSupervisor || !selectedCar) return;

    assignCar.mutate(
      { carId: selectedCar, supervisorId: selectedSupervisor },
      {
        onSuccess: () => {
          setAssignDialogOpen(false);
          setSelectedSupervisor('');
          setSelectedCar('');
        },
      }
    );
  };

  // Get cars already assigned
  const assignedCarIds = new Set(assignments?.map((a) => a.car_id) || []);
  const availableCars = cars?.filter((c) => c.status === 'active');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Management
          </h1>
          <p className="text-muted-foreground">Manage user roles, permissions, and car assignments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with optional role assignment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password (min 6 characters)"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(val) => setNewUser({ ...newUser, role: val as AppRole | 'none' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Role</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setShowPassword(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="assignments">Car Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Users ({filteredUsers?.length || 0})
              </CardTitle>
              <CardDescription>
                Assign roles to users. Admins have full access, managers can manage fleet and services, supervisors only see assigned cars.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers && filteredUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Assign Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {u.name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              {u.id === user?.id && (
                                <span className="text-xs text-muted-foreground">(You)</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateDMY(u.created_at)}</TableCell>
                        <TableCell>
                          {u.role ? (
                            <Badge
                              variant={
                                u.role === 'admin'
                                  ? 'accent'
                                  : u.role === 'supervisor'
                                    ? 'warning'
                                    : 'muted'
                              }
                            >
                              {u.role.toUpperCase()}
                            </Badge>
                          ) : (
                            <Badge variant="muted">
                              <UserX className="h-3 w-3 mr-1" />
                              No Role
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role || 'none'}
                            onValueChange={(val) => handleRoleChange(u.id, val)}
                            disabled={u.id === user?.id || assignRole.isPending}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Role</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No users found</h3>
                  <p className="text-muted-foreground">
                    {search ? 'Try a different search term' : 'No users registered yet'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          {/* Car Assignments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Car Assignments
                </CardTitle>
                <CardDescription>
                  Assign cars to supervisors. Supervisors can only view and manage their assigned cars.
                </CardDescription>
              </div>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Assign Car
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Car to Supervisor</DialogTitle>
                    <DialogDescription>
                      Select a supervisor and a car to create an assignment.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Supervisor</Label>
                      <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          {supervisors?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(!supervisors || supervisors.length === 0) && (
                        <p className="text-xs text-muted-foreground">
                          No supervisors found. Create a user with the Supervisor role first.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Car</Label>
                      <Select value={selectedCar} onValueChange={setSelectedCar}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select car" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCars?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.vehicle_number} - {c.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAssignCar}
                      disabled={!selectedSupervisor || !selectedCar || assignCar.isPending}
                    >
                      {assignCar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Assign
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : assignments && assignments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Car</TableHead>
                      <TableHead>Assigned On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.supervisor?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{a.cars?.vehicle_number}</p>
                            <p className="text-xs text-muted-foreground">{a.cars?.model}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateDMY(a.assigned_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => unassignCar.mutate({ id: a.id })}
                            disabled={unassignCar.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No car assignments</h3>
                  <p className="text-muted-foreground">
                    Assign cars to supervisors to control their access.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
