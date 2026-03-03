"use client";

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// import { BaseCrudService } from '@/integrations';
import { useMember } from '@/integrations';
import { WorkOrder } from '@/types/workorder';
import { StaffMembers } from '@/entities';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Edit3, RefreshCw } from 'lucide-react';
import Header from '@/components/layout/Header';
import ResidentHeader from '@/components/layout/ResidentHeader';
import AdminHeader from '@/components/layout/AdminHeader';
import Footer from '@/components/layout/Footer';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, userRole: role } = useMember();
  
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMembers[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // CRITICAL: Load work orders when member data is available
  // This ensures the privacy filter has access to the resident's email
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;

    loadWorkOrders();
    loadStaffMembers();
  }, [authLoading, isAuthenticated, role]);

  // Auto-refresh when user returns to the tab
  // Auto-refresh when user returns to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      if (authLoading) return;
      if (!isAuthenticated) return;

      console.log("📱 DashboardPage - User returned to tab, refreshing data");
      loadWorkOrders();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [authLoading, isAuthenticated, role]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadWorkOrders();
      console.log('✅ DashboardPage - Manual refresh completed');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadWorkOrders = async () => {
    setIsLoading(true);
    try {
      const url =
        role === "admin"
          ? "/api/admin/work-orders" // we’ll add this after dashboard works
          : "/api/resident/work-orders";

      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      const items = data?.items || [];
      // already sorted by API, but safe:
      setWorkOrders(items);
    } catch (e) {
      console.error("Error loading work orders:", e);
      setWorkOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

 const loadStaffMembers = async () => {
    try {
      const res = await fetch("/api/staff", { credentials: "include" });
      const data = await res.json();
      setStaffMembers(data?.items || []);
    } catch (e) {
      console.error("Error loading staff members:", e);
      setStaffMembers([]);
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

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    filterOrders();
  }, [workOrders, searchTerm, statusFilter, priorityFilter]);

  const getStatusColor = (status: WorkOrder['status'] | undefined) => {
    const colors: Record<string, string> = {
      pending: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      // assigned: 'bg-primary text-primary-foreground border-primary-foreground/20',
      'in-progress': 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      completed: 'bg-primary text-primary-foreground border-primary-foreground/20',
      cancelled: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
    };
    return colors[status || 'pending'] || colors.pending;
  };

  const getPriorityColor = (priority: WorkOrder['priority'] | undefined) => {
    const colors: Record<string, string> = {
      low: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      medium: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      high: 'bg-primary text-primary-foreground border-primary-foreground/20',
      urgent: 'bg-destructive text-destructive-foreground border-destructive/20',
    };
    return colors[priority || 'medium'] || colors.medium;
  };

  return (
    <div className="min-h-screen bg-primary">
      {role === 'admin' ? <AdminHeader /> : <ResidentHeader />}

      <main className="max-w-[120rem] mx-auto px-6 lg:px-12 py-16">
        <div className="mb-12">
          <h1 className="font-heading text-5xl lg:text-6xl text-primary-foreground mb-4">
            {role === 'admin' ? 'Admin Dashboard' : 'My Work Orders'}
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80">
            {role === 'admin' 
              ? 'Manage and track all work orders in one place' 
              : 'View and manage your submitted work orders'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Filter size={20} className="text-secondary-foreground" />
              <h2 className="font-heading text-2xl text-secondary-foreground">
                Filters
              </h2>
            </div>
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              variant="outline"
              className="border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary font-paragraph flex items-center gap-2"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                {/* <SelectItem value="assigned">Assigned</SelectItem> */}
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

                {/* Cost Information - Always Visible */}
                {(order.estimatedCost || order.actualCost) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-secondary-foreground/5 rounded-2xl border border-secondary-foreground/10">
                    {order.estimatedCost && (
                      <div>
                        <span className="font-paragraph text-secondary-foreground/60 text-sm">Estimated Cost:</span>
                        <p className="font-heading text-xl text-secondary-foreground mt-1">${order.estimatedCost.toFixed(2)}</p>
                      </div>
                    )}
                    {order.actualCost && (
                      <div>
                        <span className="font-paragraph text-secondary-foreground/60 text-sm">Actual Cost:</span>
                        <p className="font-heading text-xl text-secondary-foreground mt-1">${order.actualCost.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Pending Section for Residents */}
                {role === 'resident' && order.paymentRequestedDate && order.paymentRequestAmount && order.paymentStatus === 'unpaid' && (
                  <div className="bg-primary/10 border-l-4 border-destructive rounded-lg p-4 mb-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-heading text-lg text-secondary-foreground mb-1">Payment Pending</p>
                        <p className="font-paragraph text-base text-secondary-foreground/70">
                          Amount Due: <span className="font-heading text-lg text-secondary-foreground">${order.paymentRequestAmount.toFixed(2)}</span>
                        </p>
                        <p className="font-paragraph text-sm text-secondary-foreground/60 mt-1">
                          Requested: {format(new Date(order.paymentRequestedDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Link to={`/payment?orderId=${order._id}`} className="inline-flex">
                        <Button className="bg-destructive text-white hover:bg-destructive/90 font-paragraph whitespace-nowrap">
                          Pay Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Admin Payment Request Status */}
                {role === 'admin' && order.paymentRequestedDate && (
                  <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4 mb-4">
                    <p className="font-paragraph text-sm text-secondary-foreground/70">
                      Payment Requested: {format(new Date(order.paymentRequestedDate), 'MMM dd, yyyy')} • Amount: ${order.paymentRequestAmount?.toFixed(2) || 'N/A'}
                    </p>
                  </div>
                )}

                <Link
                  to={`/work-order/${order._id}`}
                  className="inline-flex items-center gap-2"
                >
                  <Button className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph flex items-center gap-2">
                    <Edit3 size={18} />
                    {role === 'admin' ? 'Edit Details' : 'View Details'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
