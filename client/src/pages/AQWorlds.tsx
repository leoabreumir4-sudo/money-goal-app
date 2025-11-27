import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Calculator, Plus, Pencil, Trash2, Check, Edit, Briefcase, Calendar, TrendingUp, Target, DollarSign } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/currency";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { usePreferences } from "@/contexts/PreferencesContext";
import { t } from "@/lib/i18n";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Component for Mark Paid button
function MonthlyStatusButtonComponent({ month, year, totalAmount }: { month: number; year: number; totalAmount: number }) {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  
  // Don't query if auth is loading or user is not available
  const { data: payment, isLoading, error } = trpc.monthlyPayments.getPayment.useQuery(
    { month, year },
    { 
      enabled: !loading && !!user,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  
  // Don't render if not authenticated
  if (loading || !user) {
    return (
      <Button size="sm" disabled className="bg-gray-600">
        ...
      </Button>
    );
  }
  
  const togglePaidMutation = trpc.monthlyPayments.togglePaid.useMutation({
    onSuccess: (data) => {
      utils.monthlyPayments.getPayment.invalidate();
      utils.goals.getActive.invalidate();
      utils.transactions.getAll.invalidate();
      
      if (data.isPaid) {
        toast.success("Month marked as paid! Transaction added to Dashboard.");
      } else {
        toast.success("Payment removed. Transaction deleted from Dashboard.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to toggle payment status");
    },
  });
  
  const isPaid = !!payment;
  
  const handleClick = () => {
    togglePaidMutation.mutate({ month, year, totalAmount });
  };
  
  if (error) {
    console.error('Error loading payment:', error);
  }
  
  return (
    <Button 
      size="sm" 
      className={isPaid ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"}
      onClick={handleClick}
      disabled={togglePaidMutation.isPending || isLoading}
    >
      {isLoading ? "..." : isPaid ? "Unmark" : "Mark Paid"}
    </Button>
  );
}

export default function AQWorlds() {
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [selectedMonthForEvents, setSelectedMonthForEvents] = useState<number | null>(null);
  
  const [projectName, setProjectName] = useState("");
  const { preferences } = usePreferences();
  const projectAmountInput = useCurrencyInput('', (preferences.numberFormat || 'en-US') as "en-US" | "pt-BR");
  const [projectMonth, setProjectMonth] = useState<number | undefined>(undefined);
  const [projectYear, setProjectYear] = useState(new Date().getFullYear());
  
  const [newEventName, setNewEventName] = useState("");
  const calcAvgValueInput = useCurrencyInput('', (preferences.numberFormat || 'en-US') as "en-US" | "pt-BR");
  const calcNumProjectsInput = useCurrencyInput('', (preferences.numberFormat || 'en-US') as "en-US" | "pt-BR");
  const editProjectAmountInput = useCurrencyInput('', (preferences.numberFormat || 'en-US') as "en-US" | "pt-BR");
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyStatusYear, setMonthlyStatusYear] = useState(new Date().getFullYear());
  
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventName, setEditingEventName] = useState("");
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
  
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  
  // Query data - but only enable when user is authenticated
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = trpc.projects.getAll.useQuery(undefined, {
    enabled: !!user && !loading,
    retry: false,
  });
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = trpc.events.getAll.useQuery(undefined, {
    enabled: !!user && !loading,
    retry: false,
  });
  
  const isLoading = projectsLoading || eventsLoading;
  
  // Don't render content until auth is loaded
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading authentication...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!user) {
    // Clear invalid token and redirect
    localStorage.removeItem('sessionToken');
    window.location.href = '/auth';
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Not authenticated. Redirecting...</div>
        </div>
      </DashboardLayout>
    );
  }
  
  // Show error state if queries failed
  if (projectsError || eventsError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 mb-4">Failed to load data</div>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.getAll.invalidate();
      setIsAddProjectModalOpen(false);
      setProjectName("");
      projectAmountInput.reset();
      setProjectMonth(undefined);
      setProjectYear(new Date().getFullYear());
      toast.success("Project added successfully!");
    },
  });

  const createEventMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      setNewEventName("");
      toast.success(t("eventAddedSuccess", preferences.language));
    },
  });

  const updateEventMutation = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      toast.success("Event updated successfully!");
    },
  });

  const toggleEventSelectionMutation = trpc.events.toggleSelection.useMutation({
    onMutate: async ({ id }) => {
      await utils.events.getAll.cancel();
      const previousEvents = utils.events.getAll.getData();
      
      utils.events.getAll.setData(undefined, (old) => {
        if (!old) return old;
        return old.map(e => e.id === id ? { ...e, isSelected: e.isSelected === 1 ? 0 : 1 } : e);
      });
      
      return { previousEvents };
    },
    onSuccess: () => {
      // Do NOT invalidate - keep the optimistic update to preserve order
    },
    onError: (err, variables, context) => {
      if (context?.previousEvents) {
        utils.events.getAll.setData(undefined, context.previousEvents);
      }
    },
  });

  const deleteEventMutation = trpc.events.delete.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      toast.success("Event deleted successfully!");
    },
  });

  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.getAll.invalidate();
      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      toast.success("Project updated successfully!");
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.getAll.invalidate();
      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      toast.success("Project deleted successfully!");
    },
  });

  // Current year projects
  const currentYearProjects = useMemo(() => {
    return projects.filter(p => p.year === selectedYear);
  }, [projects, selectedYear]);

  // Calculate statistics
  const totalProjects = currentYearProjects.length;
  const totalAnnual = currentYearProjects.reduce((sum, p) => sum + p.amount, 0);
  
  // Monthly Average: only months with at least 1 project
  const monthlyAverage = useMemo(() => {
    const monthsWithProjects = new Set(currentYearProjects.map(p => p.month));
    const numMonthsWithProjects = monthsWithProjects.size;
    return numMonthsWithProjects > 0 ? totalAnnual / numMonthsWithProjects : 0;
  }, [currentYearProjects, totalAnnual]);

  // Projected Annual: current average × 12
  const projectedAnnual = monthlyAverage * 12;

  // Goal Analysis (placeholder values - can be made dynamic)
  const avgSetValue = totalProjects > 0 ? totalAnnual / totalProjects : 0;
  const goalTarget = 15000 * 100; // $15,000 in cents
  const setsNeededForGoal = avgSetValue > 0 ? Math.ceil(goalTarget / avgSetValue) : 0;
  const monthlySetsAvg = useMemo(() => {
    const monthsWithProjects = new Set(currentYearProjects.map(p => p.month));
    const numMonthsWithProjects = monthsWithProjects.size;
    return numMonthsWithProjects > 0 ? totalProjects / numMonthsWithProjects : 0;
  }, [currentYearProjects, totalProjects]);

  // Next Month events
  const nextMonth = (new Date().getMonth() + 2) % 12 || 12; // Next month (1-12)
  const nextMonthName = months[nextMonth - 1];
  const nextMonthEvents = useMemo(() => {
    return events.filter(e => e.month === nextMonth && e.isSelected === 1);
  }, [events, nextMonth]);

  // Monthly Status
  const monthlyStatus = useMemo(() => {
    const statusByMonth: Record<number, { count: number; total: number }> = {};
    
    projects
      .filter(p => p.year === monthlyStatusYear)
      .forEach(p => {
        if (!statusByMonth[p.month]) {
          statusByMonth[p.month] = { count: 0, total: 0 };
        }
        statusByMonth[p.month].count++;
        statusByMonth[p.month].total += p.amount;
      });
    
    return Object.entries(statusByMonth)
      .map(([month, data]) => ({
        month: parseInt(month),
        monthName: months[parseInt(month) - 1],
        ...data,
      }))
      .sort((a, b) => b.month - a.month); // Most recent first
  }, [projects, monthlyStatusYear]);

  const handleAddProject = () => {
    if (!projectName || !projectAmountInput.displayValue || !projectMonth) {
      toast.error("Please fill in all fields");
      return;
    }

    createProjectMutation.mutate({
      name: projectName,
      amount: Math.round(projectAmountInput.getNumericValue() * 100),
      month: projectMonth,
      year: projectYear,
    });
  };

  const handleAddEvent = () => {
    if (!newEventName || selectedMonthForEvents === null) {
      toast.error("Please enter an event name");
      return;
    }

    createEventMutation.mutate({
      name: newEventName,
      month: selectedMonthForEvents,
    });
  };

  const handleToggleEvent = (eventId: number) => {
    toggleEventSelectionMutation.mutate({ id: eventId });
  };

  const handleDeleteEvent = (eventId: number) => {
    deleteEventMutation.mutate({ id: eventId });
  };

  const startEditingEvent = (eventId: number, currentName: string) => {
    setEditingEventId(eventId);
    setEditingEventName(currentName);
  };

  const saveEventName = () => {
    if (!editingEventId || !editingEventName.trim()) return;
    
    updateEventMutation.mutate(
      { id: editingEventId, name: editingEventName },
      {
        onSuccess: () => {
          setEditingEventId(null);
          setEditingEventName("");
        },
      }
    );
  };

  const openEventModal = (monthIndex: number) => {
    setSelectedMonthForEvents(monthIndex);
    setIsEventModalOpen(true);
  };

  const monthEvents = useMemo(() => {
    if (selectedMonthForEvents === null) return [];
    return events
      .filter(e => e.month === selectedMonthForEvents)
      .sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        return orderA - orderB;
      });
  }, [events, selectedMonthForEvents]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (!monthEvents || monthEvents.length === 0) return;
    
    try {
      const items = Array.from(monthEvents);
      const [reorderedItem] = items.splice(result.source.index, 1);
      
      if (!reorderedItem || !reorderedItem.id) {
        console.error('Invalid item being dragged');
        return;
      }
      
      items.splice(result.destination.index, 0, reorderedItem);
      
  const isLoading = projectsLoading || eventsLoading;
      // Update sortOrder for all items
      for (let i = 0; i < items.length; i++) {
        if (!items[i] || !items[i].id) continue;
        
        const currentOrder = typeof items[i].sortOrder === 'number' ? items[i].sortOrder : -1;
        if (currentOrder !== i) {
          await updateEventMutation.mutateAsync({ id: items[i].id, sortOrder: i });
        }
      }
      
      utils.events.getAll.invalidate();
    } catch (error) {
      console.error('Failed to reorder events:', error);
      toast.error('Failed to reorder events');
      utils.events.getAll.invalidate();
    }
  };

  // Check if a month has selected events
  const monthHasSelectedEvents = (monthIndex: number) => {
    return events.some(e => e.month === monthIndex && e.isSelected === 1);
  };

  // Get current month
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Calculator total
  const calculatorTotal = useMemo(() => {
    const avg = calcAvgValueInput.getNumericValue();
    const num = calcNumProjectsInput.getNumericValue();
    return avg * num;
  }, [calcAvgValueInput.displayValue, calcNumProjectsInput.displayValue]);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AQWorlds Dashboard</h1>
              <p className="text-muted-foreground">{user?.name || 'Artist'} - Artist Projects</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCalculatorModalOpen(true)} className="hover:bg-blue-500/10 hover:border-blue-500/50 transition-all">
              <Calculator className="mr-2 h-4 w-4" />
              Calculator
            </Button>
            <Button onClick={() => setIsAddProjectModalOpen(true)} className="bg-gradient-to-r from-purple-600 to-purple-700 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300">
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </div>

        {/* Statistics Row */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-gradient-to-br from-card to-card/80 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-purple-500/15 via-purple-500/10 to-purple-500/5 border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Briefcase className="h-5 w-5 text-purple-500" />
                  </div>
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Projects ({selectedYear})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-500">{totalProjects}</div>
              </CardContent>
            </Card>

          <Card className="bg-gradient-to-br from-green-500/15 via-green-500/10 to-green-500/5 border-green-500/30 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Annual</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">${formatNumber(totalAnnual / 100, 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-blue-500/5 border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Monthly Average</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">${formatNumber(monthlyAverage / 100, 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500/15 via-pink-500/10 to-pink-500/5 border-pink-500/30 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 group">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-pink-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5 text-pink-500" />
                </div>
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Projected Annual</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-500">${formatNumber(projectedAnnual / 100, 0)}</div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Second Row: Next Month, Goal Analysis, Monthly Status */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gradient-to-br from-card to-card/80 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-6 w-36" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Next Month */}
            <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle>Next Month: {nextMonthName}</CardTitle>
                </div>
              </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nextMonthEvents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No events selected for next month</p>
                ) : (
                  nextMonthEvents.map(event => (
                    <div key={event.id} className="text-sm">
                      {event.name}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Goal Analysis */}
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle>Goal Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Avg Set Value</div>
                  <div className="text-2xl font-bold">${formatNumber(avgSetValue / 100, 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Sets Needed for Goal</div>
                  <div className="text-2xl font-bold">{formatNumber(setsNeededForGoal, 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Monthly Sets (avg)</div>
                  <div className="text-2xl font-bold">{formatNumber(monthlySetsAvg, 1)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Status */}
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-500" />
                  </div>
                  <CardTitle>Monthly Status</CardTitle>
                </div>
                <Select value={monthlyStatusYear.toString()} onValueChange={(v) => setMonthlyStatusYear(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(projects.map(p => p.year))).sort((a, b) => b - a).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                    {!projects.some(p => p.year === new Date().getFullYear()) && (
                      <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {monthlyStatus.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No projects for this year</p>
                ) : (
                  monthlyStatus.map(status => (
                    <div key={status.month} className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-gradient-to-r from-card to-card/80 hover:shadow-md transition-all">
                      <div>
                        <div className="font-medium">{status.monthName}-{monthlyStatusYear}</div>
                        <div className="text-xs text-muted-foreground">
                          {status.count} {status.count === 1 ? 'project' : 'projects'} • ${formatNumber(status.total / 100, 0)}
                        </div>
                      </div>
                      <MonthlyStatusButtonComponent 
                        month={status.month} 
                        year={monthlyStatusYear} 
                        totalAmount={status.total}
                      />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Event Calendar */}
        {isLoading ? (
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-7 w-64" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="bg-gradient-to-br from-card to-card/80 border-border/50">
                    <CardHeader className="pb-3">
                      <Skeleton className="h-5 w-28" />
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <CardTitle>Event Calendar - {selectedYear}</CardTitle>
              </div>
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {months.map((month, index) => {
                const monthIndex = index + 1;
                const hasSelectedEvents = monthHasSelectedEvents(monthIndex);
                const isCurrentMonth = monthIndex === currentMonth;
                const monthEventsList = events.filter(e => e.month === monthIndex);
                
                return (
                  <Card 
                    key={month} 
                    className={`cursor-pointer bg-gradient-to-br from-card to-card/80 border-border/50 transition-all hover:scale-105 hover:shadow-lg ${
                      isCurrentMonth ? 'ring-2 ring-blue-500 shadow-blue-500/20' : ''
                    }`}
                    onClick={() => openEventModal(monthIndex)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{month}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1 text-xs">
                        {monthEventsList.length === 0 ? (
                          <div className="text-muted-foreground">No events</div>
                        ) : (
                          monthEventsList.slice(0, 5).map(event => (
                            <div 
                              key={event.id} 
                              className={event.isSelected === 1 ? "text-green-500 font-semibold" : "text-muted-foreground"}
                            >
                              • {event.name}
                            </div>
                          ))
                        )}
                        {monthEventsList.length > 5 && (
                          <div className="text-muted-foreground italic">
                            +{monthEventsList.length - 5} more...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Project Logs */}
        {isLoading ? (
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-7 w-40" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded-lg border border-border/50 bg-gradient-to-r from-card to-card/80">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Briefcase className="h-5 w-5 text-purple-500" />
                </div>
                <CardTitle>Project Logs</CardTitle>
              </div>
            </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No projects yet</p>
              ) : (
                projects
                  .sort((a, b) => {
                    // Sort by year desc, then month desc
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                  })
                  .map((project) => (
                    <div 
                      key={project.id} 
                      className="flex justify-between items-center p-4 rounded-lg border border-border/50 bg-gradient-to-r from-card to-card/80 hover:shadow-md hover:border-purple-500/30 transition-all cursor-pointer"
                      onClick={() => {
                        setEditingProject(project);
                        editProjectAmountInput.setValue((project.amount / 100).toString());
                        setIsEditProjectModalOpen(true);
                      }}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {months[project.month - 1]} {project.year}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-500">
                        ${formatNumber(project.amount / 100, 2)}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Add Project Modal */}
        <Dialog open={isAddProjectModalOpen} onOpenChange={setIsAddProjectModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl">Add New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectAmount">Amount ($)</Label>
                <Input
                  id="projectAmount"
                  type="text"
                  inputMode="decimal"
                  value={projectAmountInput.displayValue}
                  onChange={(e) => projectAmountInput.handleChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectMonth">Month</Label>
                <Select value={projectMonth?.toString() || ""} onValueChange={(v) => setProjectMonth(parseInt(v))}>
                  <SelectTrigger id="projectMonth">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month, index) => (
                      <SelectItem key={month} value={(index + 1).toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectYear">Year</Label>
                <Input
                  id="projectYear"
                  type="number"
                  value={projectYear}
                  onChange={(e) => setProjectYear(parseInt(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddProjectModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddProject}>Add Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Event Modal */}
        <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl">
                {selectedMonthForEvents !== null && months[selectedMonthForEvents - 1]} Events
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-2">
              {/* Event List */}
              {!events || events.length === 0 || !user ? (
                <div className="text-center py-8 text-muted-foreground">Loading events...</div>
              ) : monthEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No events for this month</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {monthEvents.filter(event => event && event.id).map((event) => (
                    <div
                      key={event.id}
                      className="relative flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-gradient-to-r from-card to-card/80 hover:shadow-md transition-all group min-h-[52px]"
                      onMouseEnter={() => setHoveredEventId(event.id)}
                      onMouseLeave={() => setHoveredEventId(null)}
                    >
                              <Checkbox
                                checked={event.isSelected === 1}
                                onCheckedChange={() => handleToggleEvent(event.id)}
                              />
                              {editingEventId === event.id ? (
                                <Input
                                  value={editingEventName}
                                  onChange={(e) => setEditingEventName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEventName();
                                    if (e.key === 'Escape') { setEditingEventId(null); setEditingEventName(''); }
                                  }}
                                  className="flex-1"
                                  autoFocus
                                />
                              ) : (
                                <span className={`flex-1 ${event.isSelected === 1 ? "text-green-500 font-semibold" : ""}`}>
                                  {event.name}
                                </span>
                              )}
                              {hoveredEventId === event.id && (
                                <div className="flex gap-1 absolute right-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (editingEventId === event.id) {
                                        saveEventName();
                                      } else {
                                        startEditingEvent(event.id, event.name);
                                      }
                                    }}
                                  >
                                    {editingEventId === event.id ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Pencil className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEvent(event.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                        ))}
                </div>
              )}

                {/* Add Custom Event */}
                <div className="border-t pt-4 space-y-3">
                <Label htmlFor="newEvent" className="text-base font-semibold">Add Custom Event</Label>
                <div className="flex gap-2">
                  <Input
                    id="newEvent"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                    placeholder="Enter event name"
                    className="flex-1"
                  />
                  <Button onClick={handleAddEvent} className="bg-gradient-to-r from-purple-600 to-purple-700 hover:shadow-lg hover:shadow-purple-500/30 transition-all">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => setIsEventModalOpen(false)} variant="outline">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Calculator Modal */}
        <Dialog open={isCalculatorModalOpen} onOpenChange={setIsCalculatorModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500 rounded-lg">
                  <Calculator className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-2xl">Project Calculator</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="calcAvg">Average Value per Project (USD)</Label>
                <Input
                  id="calcAvg"
                  type="text"
                  inputMode="decimal"
                  value={calcAvgValueInput.displayValue}
                  onChange={(e) => calcAvgValueInput.handleChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calcNum">Number of Projects</Label>
                <Input
                  id="calcNum"
                  type="text"
                  inputMode="decimal"
                  value={calcNumProjectsInput.displayValue}
                  onChange={(e) => calcNumProjectsInput.handleChange(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="p-6 bg-purple-500/20 rounded-lg text-center">
                <div className="text-sm text-muted-foreground mb-2">Total Income</div>
                <div className="text-4xl font-bold">${formatNumber(calculatorTotal, 2)}</div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsCalculatorModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Project Modal */}
        <Dialog open={isEditProjectModalOpen} onOpenChange={setIsEditProjectModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl">Edit Project</DialogTitle>
            </DialogHeader>
            {editingProject && (
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editProjectName">Project Name</Label>
                  <Input
                    id="editProjectName"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    placeholder="Enter project name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editProjectAmount">Amount ($)</Label>
                  <Input
                    id="editProjectAmount"
                    type="text"
                    inputMode="decimal"
                    value={editProjectAmountInput.displayValue}
                    onChange={(e) => editProjectAmountInput.handleChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editProjectMonth">Month</Label>
                  <Select 
                    value={editingProject.month.toString()} 
                    onValueChange={(v) => setEditingProject({ ...editingProject, month: parseInt(v) })}
                  >
                    <SelectTrigger id="editProjectMonth">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={month} value={(index + 1).toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editProjectYear">Year</Label>
                  <Input
                    id="editProjectYear"
                    type="number"
                    value={editingProject.year}
                    onChange={(e) => setEditingProject({ ...editingProject, year: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm('Are you sure you want to delete this project?')) {
                    deleteProjectMutation.mutate({ id: editingProject.id });
                  }
                }}
              >
                Delete
              </Button>
              <Button variant="outline" onClick={() => setIsEditProjectModalOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                updateProjectMutation.mutate({
                  id: editingProject.id,
                  name: editingProject.name,
                  amount: Math.round(editProjectAmountInput.getNumericValue() * 100),
                  month: editingProject.month,
                  year: editingProject.year,
                });
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
