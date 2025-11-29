import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Calendar, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { useIsMobile } from "@/hooks/useMobile";

export default function BillsPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    dueDay: "1",
    frequency: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    categoryId: "",
    reminderDaysBefore: "3",
    autoCreateTransaction: false,
  });

  const { data: bills, isLoading } = trpc.billReminders.getAll.useQuery();
  const { data: upcoming } = trpc.billReminders.getUpcoming.useQuery({ daysAhead: 30 });
  const { data: categories } = trpc.categories.getAll.useQuery();

  const createBill = trpc.billReminders.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsCreateOpen(false);
      setFormData({
        name: "",
        amount: "",
        dueDay: "1",
        frequency: "monthly",
        categoryId: "",
        reminderDaysBefore: "3",
        autoCreateTransaction: false,
      });
    },
  });

  const markAsPaid = trpc.billReminders.markAsPaid.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const deleteBill = trpc.billReminders.delete.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const handleCreate = () => {
    createBill.mutate({
      name: formData.name,
      amount: Math.round(parseFloat(formData.amount) * 100),
      dueDay: parseInt(formData.dueDay),
      frequency: formData.frequency,
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
      reminderDaysBefore: parseInt(formData.reminderDaysBefore),
      autoCreateTransaction: formData.autoCreateTransaction,
    });
  };

  const getDaysUntilDue = (date: Date) => {
    return differenceInDays(new Date(date), new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "overdue": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  const activeBills = bills?.filter(b => b.isActive) || [];

  return (
    <DashboardLayout>
      <div className={`container mx-auto ${isMobile ? 'p-3 space-y-3' : 'p-6 space-y-6'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className={isMobile ? 'text-xl font-bold' : 'text-3xl font-bold'}>Bill Reminders</h1>
            <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-base'}`}>Never miss a payment</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bill Reminder</DialogTitle>
              <DialogDescription>Set up automatic reminders for recurring bills</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bill Name</Label>
                <Input
                  placeholder="Electricity, Rent, Netflix..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="15"
                    value={formData.dueDay}
                    onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formData.frequency} onValueChange={(v: any) => setFormData({ ...formData, frequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remind me (days before)</Label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.reminderDaysBefore}
                  onChange={(e) => setFormData({ ...formData, reminderDaysBefore: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-create transaction</Label>
                  <p className="text-xs text-muted-foreground">When marked as paid</p>
                </div>
                <Switch
                  checked={formData.autoCreateTransaction}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoCreateTransaction: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.name || !formData.amount}>
                Add Bill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upcoming Bills */}
      {upcoming && upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📅 Upcoming (Next 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((bill) => {
              const daysUntil = getDaysUntilDue(bill.nextDueDate);
              const category = categories?.find(c => c.id === bill.categoryId);
              
              return (
                <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category?.emoji} ${(bill.amount / 100).toFixed(2)} • 
                        {daysUntil === 0 ? " Due today" : daysUntil === 1 ? " Due tomorrow" : ` Due in ${daysUntil} days`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => markAsPaid.mutate({ id: bill.id })}
                  >
                    <Check className="h-4 w-4" />
                    Mark Paid
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Bills */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">All Bills</h2>
        <div className="grid gap-3">
          {activeBills.map((bill) => {
            const category = categories?.find(c => c.id === bill.categoryId);
            
            return (
              <Card key={bill.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{bill.name}</h3>
                        <Badge className={getStatusColor(bill.status)}>{bill.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{category?.emoji} {category?.name || "No category"}</span>
                        <span>${(bill.amount / 100).toFixed(2)}</span>
                        <span className="capitalize">{bill.frequency}</span>
                        <span>Day {bill.dueDay}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Next due: {format(new Date(bill.nextDueDate), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsPaid.mutate({ id: bill.id })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteBill.mutate({ id: bill.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {activeBills.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No bills tracked yet</p>
            <Button onClick={() => setIsCreateOpen(true)}>Add Your First Bill</Button>
          </CardContent>
        </Card>
      )}
    </div>
    </DashboardLayout>
  );
}
