"use client";

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMember } from '@/integrations';
import { StaffMembers, Residents } from '@/entities';
import { WorkOrder } from '@/types/workorder';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Users, Settings, Edit3, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/layout/Header';
import AdminHeader from '@/components/layout/AdminHeader';
import Footer from '@/components/layout/Footer';
import { format } from 'date-fns';

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const memberContext = useMember();
  const isAdmin = (memberContext as any).userRole === 'admin';
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMembers[]>([]);
  const [residents, setResidents] = useState<Residents[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'residents'>('orders');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Debug: Log role detection
  useEffect(() => {
    console.log('📊 AdminDashboardPage - Role:', {
      userRole: (memberContext as any).userRole,
      isAdmin,
      adminSession: localStorage.getItem('adminSession'),
      devModeRole: localStorage.getItem('devModeRole'),
    });
  }, [(memberContext as any).userRole, isAdmin]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [workOrders, searchTerm, statusFilter, priorityFilter, assignedFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, staffRes] = await Promise.all([
        fetch("/api/admin/work-orders", { credentials: "include" }),
        fetch("/api/staff", { credentials: "include" }),
      ]);

      const residentsRes = await fetch("/api/admin/residents", { credentials: "include" });
      const residentsData = await residentsRes.json();
      setResidents(residentsData?.items || []);

      if (!ordersRes.ok) {
        
        console.error("Orders API failed:", ordersRes.status);
        throw new Error("Orders API failed");
      }

      if (!staffRes.ok) {
        console.error("Staff API failed:", staffRes.status);
        throw new Error("Staff API failed");
      }

      const ordersData = await ordersRes.json();

      console.log(ordersData)
      const staffData = await staffRes.json();

      const orders: WorkOrder[] = ordersData?.items || [];

      // Log payment amounts for debugging
      console.log('💰 AdminDashboardPage - Work Orders Loaded:', {
        totalOrders: orders.length,
        paymentDetails: orders.map(o => ({
          _id: o.resident_id,
          title: o.title,
          actualCost: o.actualCost,
          
          paymentStatus: o.paymentStatus,
          paymentRequestedDate: o.paymentRequestedDate,
        })),
      });

      setWorkOrders(orders);
      setStaffMembers(staffData?.items || []);
      // setResidents(residentsResponse?.items || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setWorkOrders([]);
      setStaffMembers([]);
      setResidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...workOrders];

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          (order.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.unitNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((order) => order.priority === priorityFilter);
    }

    if (assignedFilter !== 'all') {
      if (assignedFilter === 'unassigned') {
        filtered = filtered.filter((order) => !order.assigned_staff_id);
      } else {
        filtered = filtered.filter((order) => order.assigned_staff_id === assignedFilter);
      }
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (status: string | undefined) => {
    const colors: Record<string, string> = {
      pending: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      // assigned: 'bg-primary text-primary-foreground border-primary-foreground/20',
      'in-progress': 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      completed: 'bg-primary text-primary-foreground border-primary-foreground/20',
      cancelled: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
    };
    return colors[status || 'pending'] || colors.pending;
  };

  const getPriorityColor = (priority: string | undefined) => {
    const colors: Record<string, string> = {
      low: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      medium: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      high: 'bg-primary text-primary-foreground border-primary-foreground/20',
      urgent: 'bg-destructive text-destructiveforeground border-destructive/20',
    };
    return colors[priority || 'medium'] || colors.medium;
  };

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter((o) => o.status === 'pending').length,
    assigned: workOrders.filter((o) => o.assigned_staff_id).length,
    completed: workOrders.filter((o) => o.status === 'completed').length,
  };

  const pendingResidents = residents.filter((r) => r.approvalStatus === 'pending');
  const approvedResidents = residents.filter((r) => r.approvalStatus === 'approved');

  const handleApproveResident = async (residentId: string, resident: Residents) => {
    setApprovingId(residentId);
    try {
      const res = await fetch(`/api/admin/residents/${residentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve resident");
      }

      await loadData();

      toast({
        title: "Resident Approved",
        description: `${resident.firstName} ${resident.lastName} has been approved.`,
      });
    } catch (error) {
      console.error("Error approving resident:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve resident. Please try again.",
        variant: "destructive",
      });
      await loadData();
    } finally {
      setApprovingId(null);
    }
  };
  const handleRejectResident = async (residentId: string, resident: Residents) => {
    setApprovingId(residentId);
    try {
      const res = await fetch(`/api/admin/residents/${residentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "rejected" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reject resident");
      }

      await loadData();

      toast({
        title: "Resident Rejected",
        description: `${resident.firstName} ${resident.lastName} has been rejected.`,
      });
    } catch (error) {
      console.error("Error rejecting resident:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject resident. Please try again.",
        variant: "destructive",
      });
      await loadData();
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-primary">
      <AdminHeader />

      <main className="max-w-[120rem] mx-auto px-6 lg:px-12 py-16">
        <div className="mb-12">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            Admin Dashboard
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80">
            Manage work orders, approve residents, and track payments
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-primary-foreground/20">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 font-paragraph text-lg transition-colors ${
              activeTab === 'orders'
                ? 'text-primary-foreground border-b-2 border-primary-foreground'
                : 'text-primary-foreground/60 hover:text-primary-foreground'
            }`}
          >
            Work Orders
          </button>
          <button
            onClick={() => setActiveTab('residents')}
            className={`py-3 font-paragraph text-lg transition-colors relative ${
              activeTab === 'residents'
                ? 'text-primary-foreground border-b-2 border-primary-foreground'
                : 'text-primary-foreground/60 hover:text-primary-foreground'
            }`}
          >
            Resident Approvals
            {pendingResidents.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {pendingResidents.length}
              </span>
            )}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Total Orders</p>
            <p className="font-heading text-4xl text-secondary-foreground">{stats.total}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Pending</p>
            <p className="font-heading text-4xl text-secondary-foreground">{stats.pending}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Assigned</p>
            <p className="font-heading text-4xl text-secondary-foreground">{stats.assigned}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Completed</p>
            <p className="font-heading text-4xl text-secondary-foreground">{stats.completed}</p>
          </div>
        </div>
        {/* Resident Approvals Tab */}
        {activeTab === 'residents' && (
          <div className="space-y-8">
            {/* Pending Approvals */}
            {pendingResidents.length > 0 && (
              <div className="bg-secondary rounded-3xl p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <AlertCircle size={24} className="text-destructive" />
                  <h2 className="font-heading text-2xl text-secondary-foreground">
                    Pending Approvals ({pendingResidents.length})
                  </h2>
                </div>

                <div className="space-y-4">
                  {pendingResidents.map((resident) => (
                    <div
                      key={resident._id}
                      className="bg-primary rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div className="flex-1">
                        <h3 className="font-heading text-xl text-primary-foreground mb-2">
                          {resident.firstName} {resident.lastName}
                        </h3>
                        <div className="space-y-1">
                          <p className="font-paragraph text-sm text-primary-foreground/70">
                            Email: {resident.email}
                          </p>
                          <p className="font-paragraph text-sm text-primary-foreground/70">
                            Phone: {resident.phoneNumber}
                          </p>
                          <p className="font-paragraph text-xs text-primary-foreground/50">
                            Requested: {/*{resident.requestDate ? format(new Date(resident.requestDate), 'MMM dd, yyyy') : 'N/A'}*/}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleApproveResident(resident._id, resident)}
                          disabled={approvingId === resident._id}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 border border-primary-foreground/20 font-paragraph flex items-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleRejectResident(resident._id, resident)}
                          disabled={approvingId === resident._id}
                          className="bg-destructive text-destructiveforeground hover:bg-destructive/90 font-paragraph flex items-center gap-2"
                        >
                          <XCircle size={18} />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Residents */}
            {approvedResidents.length > 0 && (
              <div className="bg-secondary rounded-3xl p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle2 size={24} className="text-primary" />
                  <h2 className="font-heading text-2xl text-secondary-foreground">
                    Approved Residents ({approvedResidents.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedResidents.map((resident) => (
                    <div key={resident._id} className="bg-primary rounded-2xl p-4">
                      <h3 className="font-heading text-lg text-primary-foreground mb-2">
                        {resident.firstName} {resident.lastName}
                      </h3>
                      <p className="font-paragraph text-sm text-primary-foreground/70 mb-1">
                        {resident.email}
                      </p>
                      <p className="font-paragraph text-xs text-primary-foreground/50">
                        Approved {/*{resident._updatedDate ? format(new Date(resident._updatedDate), 'MMM dd, yyyy') : 'N/A'}*/}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingResidents.length === 0 && approvedResidents.length === 0 && (
              <div className="text-center py-20">
                <p className="font-paragraph text-xl text-primary-foreground/80">No residents yet</p>
              </div>
            )}
          </div>
        )}
        
        {/* Work Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-8">
            {/* Staff Members Quick View */}
            {staffMembers.length > 0 && (
              <div className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-secondary-foreground" />
                    <h2 className="font-heading text-2xl text-secondary-foreground">
                      Staff Members ({staffMembers.length})
                    </h2>
                  </div>
                  <Link to="/staff-management">
                    <Button className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph flex items-center gap-2">
                      <Settings size={18} />
                      Manage Staff
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staffMembers.map((staff) => (
                    <div key={staff._id} className="bg-primary rounded-2xl p-4">
                      <p className="font-heading text-lg text-primary-foreground">{staff.full_name}</p>
                      <p className="font-paragraph text-sm text-primary-foreground/70">{staff.role}</p>
                      <p className="font-paragraph text-xs text-primary-foreground/50 mt-2">{staff.email}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <Filter size={20} className="text-secondary-foreground" />
                <h2 className="font-heading text-2xl text-secondary-foreground">
                  Filters
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-foreground/50" size={20} />
                  <Input
                    placeholder="Search by title, unit, or owner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                  <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                    <SelectValue placeholder="Filter by assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignments</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffMembers.map((staff) => (
                      <SelectItem key={staff._id} value={staff._id}>
                        {staff.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Orders List */}
            {isLoading ? (
              <div className="text-center py-20">
                <p className="font-paragraph text-xl text-primary-foreground/80">Loading work orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-paragraph text-xl text-primary-foreground/80">No work orders found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredOrders.map((order) => (
                  <div
                    key={order._id}
                    className="bg-secondary rounded-3xl p-6 lg:p-8 hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h3 className="font-heading text-2xl text-secondary-foreground mb-2">
                          {order.title || 'Untitled'}
                        </h3>
                        <p className="font-paragraph text-base text-secondary-foreground/70">
                          Unit {order.unitNumber || 'N/A'} • {order.ownerName || 'Unknown'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Badge className={`${getStatusColor(order.status)} border font-paragraph`}>
                          {(order.status || 'pending').replace('-', ' ').toUpperCase()}
                        </Badge>
                        <Badge className={`${getPriorityColor(order.priority)} border font-paragraph`}>
                          {(order.priority || 'medium').toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-paragraph text-secondary-foreground/60">Created:</span>
                        <span className="font-paragraph text-secondary-foreground ml-2">
                          {order._createdAt ? format(new Date(order._createdAt), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="font-paragraph text-secondary-foreground/60">Payment:</span>
                        <span className="font-paragraph text-secondary-foreground ml-2">
                          {(order.paymentStatus || 'unpaid').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-paragraph text-secondary-foreground/60">Assigned to:</span>
                        <span className="font-paragraph text-secondary-foreground ml-2">
                          {order.assigned_staff_id ? staffMembers.find((s) => s._id === order.assigned_staff_id)?.full_name || 'Unknown' : 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {/* Payment Request Status */}
                    {order.paymentRequestedDate && (
                      <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4 mb-4">
                        <p className="font-paragraph text-sm text-secondary-foreground/70">
                          Payment Requested: {format(new Date(order.paymentRequestedDate), 'MMM dd, yyyy')} • Amount: ${order.actualCost?.toFixed(2) || 'N/A'} • Status: {order.paymentStatus.toUpperCase()}
                        </p>
                      </div>
                    )}

                    <Link
                      to={`/work-order/${order._id}`}
                      className="inline-flex items-center gap-2"
                    >
                      <Button className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph flex items-center gap-2">
                        <Edit3 size={18} />
                        Edit Details
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
