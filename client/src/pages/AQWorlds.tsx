import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Calculator, Plus, Pencil, Trash2, Check, Edit } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatNumber } from "@/lib/currency";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Component for Mark Paid button
function MonthlyStatusButtonComponent({ month, year, totalAmount }: { month: number; year: number; totalAmount: number }) {
  const utils = trpc.useUtils();
  const { data: payment, isLoading, error } = trpc.monthlyPayments.getPayment.useQuery(
    { month, year },
    { 
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  
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
  const [projectAmount, setProjectAmount] = useState("");
  const [projectMonth, setProjectMonth] = useState<number | undefined>(undefined);
  const [projectYear, setProjectYear] = useState(new Date().getFullYear());
  
  const [newEventName, setNewEventName] = useState("");
  const [calcAvgValue, setCalcAvgValue] = useState("");
  const [calcNumProjects, setCalcNumProjects] = useState("");
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyStatusYear, setMonthlyStatusYear] = useState(new Date().getFullYear());
  
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingEventName, setEditingEventName] = useState("");
  const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
  
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: projects = [] } = trpc.projects.getAll.useQuery();
  const { data: events = [] } = trpc.events.getAll.useQuery();

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.getAll.invalidate();
      setIsAddProjectModalOpen(false);
      setProjectName("");
      setProjectAmount("");
      setProjectMonth(undefined);
      setProjectYear(new Date().getFullYear());
      toast.success("Project added successfully!");
    },
  });

  const createEventMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.getAll.invalidate();
      setNewEventName("");
      toast.success("Event added successfully!");
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
    onError: (err, variables, context) => {
      if (context?.previousEvents) {
        utils.events.getAll.setData(undefined, context.previousEvents);
      }
    },
    onSettled: () => {
      utils.events.getAll.invalidate();
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
    if (!projectName || !projectAmount || !projectMonth) {
      toast.error("Please fill in all fields");
      return;
    }

    createProjectMutation.mutate({
      name: projectName,
      amount: Math.round(parseFloat(projectAmount) * 100),
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
    
    const items = Array.from(monthEvents);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update sortOrder for all items
    try {
      for (let i = 0; i < items.length; i++) {
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
    const avg = parseFloat(calcAvgValue) || 0;
    const num = parseInt(calcNumProjects) || 0;
    return avg * num;
  }, [calcAvgValue, calcNumProjects]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">AQWorlds Dashboard</h1>
            <p className="text-muted-foreground">{user?.name || 'Artist'} - Artist Projects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCalculatorModalOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" />
              Calculator
            </Button>
            <Button onClick={() => setIsAddProjectModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </div>

        {/* Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalProjects}</div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Annual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">${formatNumber(totalAnnual / 100, 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Average</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">${formatNumber(monthlyAverage / 100, 0)}</div>
            </CardContent>
          </Card>

          <Card className="bg-pink-500/10 border-pink-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projected Annual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-500">${formatNumber(projectedAnnual / 100, 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row: Next Month, Goal Analysis, Monthly Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Next Month */}
          <Card>
            <CardHeader>
              <CardTitle>Next Month: {nextMonthName}</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle>Goal Analysis</CardTitle>
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
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Monthly Status</CardTitle>
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
                    <div key={status.month} className="flex justify-between items-center p-2 rounded border">
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

        {/* Event Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>📅 Event Calendar - {selectedYear}</CardTitle>
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
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      isCurrentMonth ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => openEventModal(monthIndex)}
                  >
                    <CardHeader className="pb-1 pt-4">
                      <CardTitle className="text-base">{month}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
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

        {/* Project Logs */}
        <Card>
          <CardHeader>
            <CardTitle>📝 Project Logs</CardTitle>
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
                      className="flex justify-between items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditingProject(project);
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
                  type="number"
                  step="0.01"
                  value={projectAmount}
                  onChange={(e) => setProjectAmount(e.target.value)}
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
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="events">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
                    >
                      {monthEvents.map((event, index) => (
                        <Draggable key={event.id} draggableId={event.id.toString()} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
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
                                <div className="flex gap-1">
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
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

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
                  <Button onClick={handleAddEvent} className="bg-purple-600 hover:bg-purple-700">
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
                  type="number"
                  step="0.01"
                  value={calcAvgValue}
                  onChange={(e) => setCalcAvgValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calcNum">Number of Projects</Label>
                <Input
                  id="calcNum"
                  type="number"
                  value={calcNumProjects}
                  onChange={(e) => setCalcNumProjects(e.target.value)}
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
                    type="number"
                    step="0.01"
                    value={(editingProject.amount / 100).toFixed(2)}
                    onChange={(e) => setEditingProject({ ...editingProject, amount: Math.round(parseFloat(e.target.value || "0") * 100) })}
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
                  amount: editingProject.amount,
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
