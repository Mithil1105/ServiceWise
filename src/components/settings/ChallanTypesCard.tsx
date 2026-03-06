import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react';
import { useChallanTypes, useCreateChallanType, useDeleteChallanType } from '@/hooks/use-challan-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ChallanTypesCard() {
  const { data: challanTypes = [], isLoading } = useChallanTypes();
  const createChallanType = useCreateChallanType();
  const deleteChallanType = useDeleteChallanType();
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createChallanType.mutate(
      { name },
      {
        onSuccess: () => setNewName(''),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Challan types
        </CardTitle>
        <CardDescription>
          Add types of traffic challans (e.g. Speeding, No helmet). These appear when logging a Traffic Challan incident and in challan reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="challan-type-name">New type</Label>
            <Input
              id="challan-type-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Speeding, No helmet"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || createChallanType.isPending}
            >
              {createChallanType.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add
            </Button>
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : challanTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No challan types yet. Add one above to use when logging Traffic Challan incidents.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challanTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell>{ct.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteChallanType.mutate(ct.id)}
                      disabled={deleteChallanType.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
