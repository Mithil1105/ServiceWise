import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
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
  EyeOff,
  KeyRound,
  Ban,
  Mail,
  User
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useOrg } from '@/hooks/use-org';
import { invokeAuthed } from '@/lib/functions-invoke';
import { formatDateDMY } from '@/lib/date';
import { formatCarLabel } from '@/lib/utils';
import { usePendingJoinRequests } from '@/hooks/use-join-organization';
import type { AppRole, Profile } from '@/types';

interface UserWithRole extends Profile {
  role?: AppRole | null;
  email?: string;
}

interface NewUserForm {
  fullName: string;
  email: string;
  tempPassword: string;
  role: AppRole | 'none';
  generatePassword: boolean;
}

function useUsersWithRoles(orgId: string | null) {
  return useQuery({
    queryKey: ['users-with-roles', orgId],
    queryFn: async (): Promise<UserWithRole[]> => {
      if (!orgId) return [];
      const { data: members, error: membersError } = await supabaseClient
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      if (membersError) throw membersError;
      if (!members?.length) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;
      const roleByUserId = new Map(members.map((m) => [m.user_id, m.role as AppRole]));
      return (profiles || []).map((p) => ({
        ...p,
        role: roleByUserId.get(p.id) ?? null,
      })) as UserWithRole[];
    },
    enabled: !!orgId,
  });
}

function useAssignRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId } = useOrg();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole | 'none' }) => {
      if (!orgId) throw new Error('Organization not found');
      if (role === 'none') {
        const { error } = await supabaseClient
          .from('organization_members')
          .delete()
          .eq('organization_id', orgId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('organization_members')
          .update({ role })
          .eq('organization_id', orgId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
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
    mutationFn: async (userData: {
      email: string;
      fullName?: string;
      tempPassword?: string;
      role: AppRole;
    }) => {
      const body: Record<string, unknown> = {
        email: userData.email.trim().toLowerCase(),
        role: userData.role,
      };
      if (userData.fullName?.trim()) body.fullName = userData.fullName.trim();
      if (userData.tempPassword?.trim() && userData.tempPassword.length >= 6) body.tempPassword = userData.tempPassword;

      const data = await invokeAuthed<{ success?: boolean; userId?: string; email?: string; tempPassword?: string }>(
        'org-admin-create-user',
        body
      );
      return data ?? {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
      // Toast is shown by the caller with detailed message (name, role).
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating user', description: error.message, variant: 'destructive' });
    },
  });
}

function useResetPassword() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { targetUserId: string; newPassword?: string }) => {
      const body: Record<string, unknown> = { targetUserId: payload.targetUserId };
      if (payload.newPassword?.trim() && payload.newPassword.length >= 6) body.newPassword = payload.newPassword;

      const data = await invokeAuthed<{ success: boolean; userId: string; newPassword?: string }>(
        'org-admin-reset-password',
        body
      );
      return data ?? { success: true, userId: body.targetUserId as string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Password reset',
        description: data.newPassword ? 'New password generated. Copy it and share securely.' : 'Password updated.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error resetting password', description: error.message, variant: 'destructive' });
    },
  });
}

function useSetActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { targetUserId: string; isActive: boolean }) => {
      const data = await invokeAuthed('org-admin-set-active', payload);
      return data ?? {};
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
      toast({
        title: variables.isActive ? 'User activated' : 'User deactivated',
        description: variables.isActive ? 'The user can sign in again.' : 'The user can no longer sign in.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export default function UserManagement() {
  const { isAdmin, isManager, user } = useAuth();
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const { data: pendingRequests = [], refetch: refetchPending } = usePendingJoinRequests(orgId);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'approve' | 'block' } | null>(null);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedCar, setSelectedCar] = useState('');
  const [newUser, setNewUser] = useState<NewUserForm>({
    fullName: '',
    email: '',
    tempPassword: '',
    role: 'none',
    generatePassword: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordResult, setResetPasswordResult] = useState<string | null>(null);

  const { data: users, isLoading } = useUsersWithRoles(orgId);
  const { data: cars } = useCars();
  const { data: assignments, isLoading: assignmentsLoading } = useCarAssignments();
  const { data: supervisors } = useSupervisors();
  const assignRole = useAssignRole();
  const createUser = useCreateUser();
  const resetPassword = useResetPassword();
  const setActive = useSetActive();
  const assignCar = useAssignCarToSupervisor();
  const unassignCar = useUnassignCarFromSupervisor();

  const isOrgAdmin = isAdmin || isManager;
  const canCreateUsers = isAdmin;
  const canAccessUserManagement = isAdmin;
  const { toast } = useToast();

  const scrollToCreateSection = () => {
    document.getElementById('create-user-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!canAccessUserManagement) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Access restricted</h2>
        <p className="text-muted-foreground mb-4">
          Only org administrators can access User Management.
        </p>
        <Button asChild>
          <Link to="/app">Back to Dashboard</Link>
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
    if (!canCreateUsers) {
      toast({ title: 'Only administrators can create user accounts', variant: 'destructive' });
      return;
    }
    if (newUser.role === 'none') {
      toast({ title: 'Please select a role', variant: 'destructive' });
      return;
    }
    const password = newUser.generatePassword ? undefined : newUser.tempPassword?.trim();
    if (!newUser.generatePassword && (!password || password.length < 8)) {
      toast({ title: 'Password required', description: 'Please enter a password with at least 8 characters or use the Generate button.', variant: 'destructive' });
      return;
    }
    if (newUser.fullName.trim().length < 2) {
      toast({ title: 'Full name required', description: 'Please enter at least 2 characters.', variant: 'destructive' });
      return;
    }
    createUser.mutate(
      {
        email: newUser.email.trim().toLowerCase(),
        fullName: newUser.fullName.trim() || undefined,
        tempPassword: password && password.length >= 8 ? password : undefined,
        role: newUser.role as AppRole,
      },
      {
        onSuccess: (data) => {
          const pwd = data.tempPassword ?? (password && password.length >= 8 ? password : null);
          if (pwd) {
            setCreatedTempPassword(pwd);
          } else {
            setNewUser({ fullName: '', email: '', tempPassword: '', role: 'none', generatePassword: true });
            setShowPassword(false);
            setCreatedTempPassword(null);
            toast({
              title: 'User created successfully',
              description: `${newUser.fullName || newUser.email} has been created as ${newUser.role}. Account is active and ready to use.`,
            });
            queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
          }
        },
      }
    );
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let s = '';
    for (let i = 0; i < 12; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewUser((prev) => ({ ...prev, tempPassword: s, generatePassword: false }));
    setShowPassword(true);
  };

  const closeAddDialog = () => {
    setNewUser({ fullName: '', email: '', tempPassword: '', role: 'none', generatePassword: true });
    setShowPassword(false);
    setCreatedTempPassword(null);
    toast({
      title: 'Password saved',
      description: 'Share the password securely with the user. They can sign in immediately.',
    });
  };

  const handleResetPassword = (targetUserId: string) => {
    setResetPasswordUserId(targetUserId);
    setResetPasswordValue('');
    setResetPasswordResult(null);
  };

  const confirmResetPassword = () => {
    if (!resetPasswordUserId) return;
    const newPassword =
      resetPasswordValue.trim().length >= 6 ? resetPasswordValue.trim() : undefined;
    resetPassword.mutate(
      {
        targetUserId: resetPasswordUserId,
        newPassword,
      },
      {
        onSuccess: (data) => {
          if (data.newPassword) {
            setResetPasswordResult(data.newPassword);
          } else {
            setResetPasswordUserId(null);
            setResetPasswordValue('');
          }
        },
      }
    );
  };

  const closeResetDialog = () => {
    setResetPasswordUserId(null);
    setResetPasswordValue('');
    setResetPasswordResult(null);
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

  const handlePendingApprove = async (memberId: string) => {
    setPendingAction({ id: memberId, action: 'approve' });
    try {
      const { error } = await supabaseClient
        .from('organization_members')
        .update({ status: 'active' })
        .eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Approved', description: 'The user can now sign in and access the organization.' });
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPendingAction(null);
    }
  };

  const handlePendingBlock = async (memberId: string) => {
    setPendingAction({ id: memberId, action: 'block' });
    try {
      const { error } = await supabaseClient
        .from('organization_members')
        .update({ status: 'blocked' })
        .eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Request declined', description: 'The join request has been declined.' });
      queryClient.invalidateQueries({ queryKey: ['organization_members'] });
      refetchPending();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending join requests</CardTitle>
            <CardDescription>Users who requested to join your organization. Approve or decline.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.name ?? req.user_id}</TableCell>
                    <TableCell>{formatDateDMY(req.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={pendingAction?.id === req.id}
                        onClick={() => handlePendingApprove(req.id)}
                      >
                        {pendingAction?.id === req.id && pendingAction?.action === 'approve' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Approve'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingAction?.id === req.id}
                        onClick={() => handlePendingBlock(req.id)}
                      >
                        {pendingAction?.id === req.id && pendingAction?.action === 'block' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Decline'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="text-muted-foreground text-sm">Create and manage user accounts for your organization with role-based access control</p>
          </div>
        </div>
      </div>

      <Dialog open={!!createdTempPassword} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password created</DialogTitle>
            <DialogDescription>Copy this password and share it securely with the user. It won&apos;t be shown again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input readOnly value={createdTempPassword ?? ''} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (createdTempPassword) {
                    navigator.clipboard.writeText(createdTempPassword);
                    toast({ title: 'Copied to clipboard' });
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={closeAddDialog}>Done</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Card id="create-user-section" className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New User
          </CardTitle>
          <CardDescription>Add new team members with appropriate access levels</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Personal information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      className="pl-9"
                      minLength={2}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@company.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Role & security</h4>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(val) => setNewUser({ ...newUser, role: val as AppRole | 'none' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor – View and manage assigned cars only</SelectItem>
                    <SelectItem value="manager">Manager – Review and verify fleet, services, and bookings</SelectItem>
                    <SelectItem value="admin">Admin – Full system access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tempPassword">Permanent Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="tempPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={newUser.generatePassword ? 'Click Generate or enter your own (min 8 characters)' : 'Min 8 characters'}
                      value={newUser.tempPassword}
                      onChange={(e) => setNewUser({ ...newUser, tempPassword: e.target.value, generatePassword: false })}
                      minLength={8}
                      className={(!newUser.generatePassword && newUser.tempPassword.length > 0 && newUser.tempPassword.length < 8) ? 'pr-20 border-destructive' : 'pr-20'}
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    Generate
                  </Button>
                </div>
                {!newUser.generatePassword && newUser.tempPassword.length > 0 && newUser.tempPassword.length < 8 && (
                  <p className="text-sm text-destructive">Password must be at least 8 characters</p>
                )}
                <p className="text-xs text-muted-foreground">Account is created and activated immediately. User can sign in right away.</p>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createUser.isPending || newUser.role === 'none' || !canCreateUsers}>
              {createUser.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating User...</> : 'Create User Account'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-base">User creation guidelines</CardTitle>
          <CardDescription>Security and account management</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <h4 className="font-medium mb-2">Security requirements</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Passwords must be at least 8 characters</li>
              <li>Emails must be unique and valid</li>
              <li>Only administrators can create user accounts</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Account management</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>New users belong to your organization only</li>
              <li>You can edit roles and reset passwords</li>
              <li>Account is created and activated immediately</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => !open && closeResetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                {resetPasswordResult
                  ? 'Copy the new password and share it securely with the user.'
                  : `Reset password for ${users?.find((x) => x.id === resetPasswordUserId)?.name ?? 'this user'}.`}
              </DialogDescription>
            </DialogHeader>
            {resetPasswordResult ? (
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input readOnly value={resetPasswordResult} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordResult);
                      toast({ title: 'Copied to clipboard' });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={closeResetDialog}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="resetPasswordInput">New password</Label>
                  <Input
                    id="resetPasswordInput"
                    type="password"
                    placeholder="Leave blank to generate a password, or type a new one (min 8 characters)"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave this empty to auto-generate a password. Otherwise enter at least 8 characters.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeResetDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmResetPassword}
                    disabled={
                      resetPassword.isPending ||
                      (resetPasswordValue.length > 0 && resetPasswordValue.length < 8)
                    }
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Reset password
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  All Users
                </CardTitle>
                <CardDescription>
                  Click a user to view details. Assign roles and reset passwords.
                </CardDescription>
              </div>
              <Button onClick={scrollToCreateSection} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Assign Role</TableHead>
                      {isOrgAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                          {u.is_active === false ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Inactive
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
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
                        {isOrgAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleResetPassword(u.id)}
                                disabled={resetPassword.isPending}
                              >
                                <KeyRound className="h-4 w-4" />
                                Reset password
                              </Button>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={u.is_active !== false}
                                  onCheckedChange={(checked) => {
                                    if (u.id === user?.id) return;
                                    setActive.mutate({ targetUserId: u.id, isActive: checked });
                                  }}
                                  disabled={u.id === user?.id || setActive.isPending}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {u.id === user?.id ? '(You)' : u.is_active === false ? 'Inactive' : 'Active'}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        )}
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
                          <p className="font-medium">{a.cars ? formatCarLabel(a.cars) : 'Unknown'}</p>
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
