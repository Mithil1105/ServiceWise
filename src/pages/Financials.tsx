import { useState } from 'react';
import { useTransfers, usePendingTransfers, useCompletedTransfers, useCompleteTransfer } from '@/hooks/use-transfers';
import { useCompanyBills } from '@/hooks/use-company-bills';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertTriangle, FileText, Calendar, User } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Financials() {
  const { user, profile } = useAuth();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [completeTransferDialogOpen, setCompleteTransferDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [cashierName, setCashierName] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  const { data: pendingTransfers } = usePendingTransfers();
  const { data: completedTransfers } = useCompletedTransfers({
    collectedByUserId: selectedManager || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: companyBills } = useCompanyBills({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const completeTransfer = useCompleteTransfer();

  // Calculate summary stats
  const totalPendingAmount = pendingTransfers?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const totalCompletedAmount = completedTransfers?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
  const overdueTransfers = pendingTransfers?.filter(t => {
    const daysSince = Math.floor((new Date().getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 5;
  }) || [];

  const handleCompleteTransfer = async () => {
    if (!selectedTransfer) return;

    try {
      await completeTransfer.mutateAsync({
        transfer_id: selectedTransfer.id,
        transfer_date: transferDate,
        cashier_name: selectedTransfer.from_account_type === 'cash' ? cashierName : null,
        notes: transferNotes || null,
      });
      setCompleteTransferDialogOpen(false);
      setSelectedTransfer(null);
      setTransferDate(new Date().toISOString().split('T')[0]);
      setCashierName('');
      setTransferNotes('');
    } catch (error) {
      console.error('Error completing transfer:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Financials</h1>
        <p className="text-muted-foreground mt-1">
          Manage advance payments, transfers, and company bills
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingTransfers?.length || 0} transfer(s) pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Transfers</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCompletedAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {completedTransfers?.length || 0} transfer(s) completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Transfers</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overdueTransfers.reduce((sum, t) => sum + (t.amount || 0), 0))}</div>
            <p className="text-xs text-muted-foreground">
              {overdueTransfers.length} transfer(s) overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company Bills</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyBills?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total company bills generated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Transfers</TabsTrigger>
          <TabsTrigger value="completed">Transfer History</TabsTrigger>
          <TabsTrigger value="company-bills">Company Bills</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label>Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => {
            setDateFrom('');
            setDateTo('');
            setSelectedManager('');
          }}>
            Clear Filters
          </Button>
        </div>

        {/* Pending Transfers Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Transfers</CardTitle>
              <CardDescription>
                Advance payments that need to be transferred to company account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Collected By</TableHead>
                    <TableHead>Bill Date</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransfers && pendingTransfers.length > 0 ? (
                    pendingTransfers.map((transfer) => {
                      const daysPending = Math.floor(
                        (new Date().getTime() - new Date(transfer.created_at).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isOverdue = daysPending > 5;

                      return (
                        <TableRow key={transfer.id}>
                          <TableCell>{transfer.bookings?.booking_ref || 'N/A'}</TableCell>
                          <TableCell>{transfer.bookings?.customer_name || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(transfer.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={transfer.from_account_type === 'cash' ? 'default' : 'secondary'}>
                              {transfer.from_account_type === 'cash' ? 'Cash' : 'Personal'}
                            </Badge>
                          </TableCell>
                          <TableCell>{transfer.collected_by_name}</TableCell>
                          <TableCell>
                            {transfer.bills?.created_at ? format(new Date(transfer.bills.created_at), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                              {daysPending} {daysPending === 1 ? 'day' : 'days'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isOverdue ? 'destructive' : 'warning'}>
                              {isOverdue ? 'Overdue' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setCompleteTransferDialogOpen(true);
                              }}
                            >
                              Mark Complete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No pending transfers
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer History Tab */}
        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer History</CardTitle>
              <CardDescription>
                Completed transfers to company account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Collected By</TableHead>
                    <TableHead>Transfer Date</TableHead>
                    <TableHead>Completed By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTransfers && completedTransfers.length > 0 ? (
                    completedTransfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>{transfer.bookings?.booking_ref || 'N/A'}</TableCell>
                        <TableCell>{transfer.bookings?.customer_name || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(transfer.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={transfer.from_account_type === 'cash' ? 'default' : 'secondary'}>
                            {transfer.from_account_type === 'cash' ? 'Cash' : 'Personal'}
                          </Badge>
                        </TableCell>
                        <TableCell>{transfer.collected_by_name}</TableCell>
                        <TableCell>
                          {transfer.transfer_date ? format(new Date(transfer.transfer_date), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>{transfer.completed_by_user_id ? 'User' : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="success">Completed</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No completed transfers
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Bills Tab */}
        <TabsContent value="company-bills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Bills</CardTitle>
              <CardDescription>
                Internal bills for company accounting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Advance Amount</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyBills && companyBills.length > 0 ? (
                    companyBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">{bill.bill_number}</TableCell>
                        <TableCell>{bill.bookings?.booking_ref || 'N/A'}</TableCell>
                        <TableCell>{bill.customer_name}</TableCell>
                        <TableCell>{formatCurrency(bill.total_amount)}</TableCell>
                        <TableCell>{formatCurrency(bill.advance_amount)}</TableCell>
                        <TableCell>{format(new Date(bill.created_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No company bills generated yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Complete Transfer Dialog */}
      <Dialog open={completeTransferDialogOpen} onOpenChange={setCompleteTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Transfer as Complete</DialogTitle>
            <DialogDescription>
              Record the transfer completion details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTransfer && (
              <>
                <div className="space-y-2">
                  <Label>Transfer Date *</Label>
                  <Input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {selectedTransfer.from_account_type === 'cash' && (
                  <div className="space-y-2">
                    <Label>Cashier Name *</Label>
                    <Input
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      placeholder="Enter cashier name"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Any additional notes..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteTransfer}
              disabled={!transferDate || (selectedTransfer?.from_account_type === 'cash' && !cashierName)}
            >
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
