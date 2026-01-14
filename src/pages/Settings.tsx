import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useServiceRules, useCreateServiceRule } from '@/hooks/use-services';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings as SettingsIcon, Plus, Wrench, Loader2, AlertCircle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { isAdmin } = useAuth();
  const { data: serviceRules, isLoading } = useServiceRules();
  const createRule = useCreateServiceRule();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    interval_km: '',
    interval_days: '',
    is_critical: false,
    due_soon_threshold_km: '500',
    due_soon_threshold_days: '7',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground mb-4">
          Only administrators can access settings.
        </p>
        <Button asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!newRule.name.trim()) {
      setErrors({ name: 'Name is required' });
      return;
    }

    if (!newRule.interval_km && !newRule.interval_days) {
      setErrors({ interval: 'At least one interval (km or days) is required' });
      return;
    }

    try {
      await createRule.mutateAsync({
        name: newRule.name.trim(),
        interval_km: newRule.interval_km ? parseInt(newRule.interval_km) : undefined,
        interval_days: newRule.interval_days ? parseInt(newRule.interval_days) : undefined,
        is_critical: newRule.is_critical,
        due_soon_threshold_km: parseInt(newRule.due_soon_threshold_km) || 500,
        due_soon_threshold_days: parseInt(newRule.due_soon_threshold_days) || 7,
      });
      setIsDialogOpen(false);
      setNewRule({
        name: '',
        interval_km: '',
        interval_days: '',
        is_critical: false,
        due_soon_threshold_km: '500',
        due_soon_threshold_days: '7',
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('service_rules')
      .update({ active: !currentActive })
      .eq('id', ruleId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['service-rules'] });
      toast({
        title: currentActive ? 'Rule disabled' : 'Rule enabled',
        description: `Service rule has been ${currentActive ? 'disabled' : 'enabled'}.`,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage service rules and system configuration</p>
        </div>
      </div>

      {/* Service Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Service Rules
            </CardTitle>
            <CardDescription>
              Define service intervals and critical thresholds
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateRule}>
                <DialogHeader>
                  <DialogTitle>Create Service Rule</DialogTitle>
                  <DialogDescription>
                    Add a new service rule that will be applied to vehicles
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="rule-name">Rule Name *</Label>
                    <Input
                      id="rule-name"
                      placeholder="e.g., Engine Oil Change"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="interval-km">Interval (km)</Label>
                      <Input
                        id="interval-km"
                        type="number"
                        placeholder="e.g., 10000"
                        value={newRule.interval_km}
                        onChange={(e) => setNewRule({ ...newRule, interval_km: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interval-days">Interval (days)</Label>
                      <Input
                        id="interval-days"
                        type="number"
                        placeholder="e.g., 180"
                        value={newRule.interval_days}
                        onChange={(e) => setNewRule({ ...newRule, interval_days: e.target.value })}
                      />
                    </div>
                  </div>
                  {errors.interval && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.interval}
                    </p>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <Label htmlFor="is-critical" className="font-medium">
                        Critical Service
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Shows popup alerts when due
                      </p>
                    </div>
                    <Switch
                      id="is-critical"
                      checked={newRule.is_critical}
                      onCheckedChange={(checked) =>
                        setNewRule({ ...newRule, is_critical: checked })
                      }
                    />
                  </div>

                  {newRule.is_critical && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="threshold-km">Due Soon Threshold (km)</Label>
                        <Input
                          id="threshold-km"
                          type="number"
                          value={newRule.due_soon_threshold_km}
                          onChange={(e) =>
                            setNewRule({ ...newRule, due_soon_threshold_km: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="threshold-days">Due Soon Threshold (days)</Label>
                        <Input
                          id="threshold-days"
                          type="number"
                          value={newRule.due_soon_threshold_days}
                          onChange={(e) =>
                            setNewRule({ ...newRule, due_soon_threshold_days: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRule.isPending}>
                    {createRule.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Rule'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : serviceRules && serviceRules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Interval (km)</TableHead>
                  <TableHead>Interval (days)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      {rule.interval_km ? `${rule.interval_km.toLocaleString()} km` : '-'}
                    </TableCell>
                    <TableCell>
                      {rule.interval_days ? `${rule.interval_days} days` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_critical ? 'error' : 'muted'}>
                        {rule.is_critical ? 'Critical' : 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.is_critical ? (
                        <span className="text-sm text-muted-foreground">
                          {rule.due_soon_threshold_km} km / {rule.due_soon_threshold_days} days
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.active ? 'success' : 'muted'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(rule.id, rule.active)}
                      >
                        {rule.active ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No service rules</h3>
              <p className="text-muted-foreground mb-4">
                Create your first service rule to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
