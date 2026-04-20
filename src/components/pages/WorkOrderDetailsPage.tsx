import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMember } from '@/integrations';
import { WorkOrder } from '@/types/workorder';
import { SavedCard } from "@/types/savedcard"
import { StaffMembers } from '@/entities';
import { notificationService } from "@/utils/notificationService";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, DollarSign, Send } from 'lucide-react';
import AdminHeader from '@/components/layout/AdminHeader';
import Footer from '@/components/layout/Footer';
import { format } from 'date-fns';

export default function WorkOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const memberContext = useMember();
  const member = memberContext.member;
  const role = memberContext.userRole ?? null;
  
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMembers[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false);
  const [isChargingCard, setIsChargingCard] = useState(false);

  const [editData, setEditData] = useState({
    status: 'pending' as WorkOrder['status'],
    assignedTo: '',
    estimatedCost: 0,
    actualCost: 0,
    paymentRequestAmount: 0,
    scheduledDate: '',
  });

  useEffect(() => {
    if (id) {
      loadWorkOrder();
      loadStaffMembers();
    }
  }, [id]);

  const loadWorkOrder = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          toast({ title: "Access Denied", description: "You cannot view this work order.", variant: "destructive" });
          navigate("/dashboard");
          return;
        }
        throw new Error(`Failed: ${res.status}`);
      }
      const data = await res.json();
      const order = data?.item as WorkOrder;
      setWorkOrder(order);

      setEditData({
        status: (order.status || "pending") as WorkOrder["status"],
        assignedTo: order.assigned_staff_id || "",
        estimatedCost: order.estimatedCost || 0,
        actualCost: order.actualCost || 0,
        paymentRequestAmount: order.paymentRequestAmount || 0,
        scheduledDate: order.scheduledDate ? format(new Date(order.scheduledDate), "yyyy-MM-dd") : "",
      });
    } catch (e) {
      console.error(e);
      setWorkOrder(null);
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
      console.error(e);
      setStaffMembers([]);
    }
  };

  const handleSave = async () => {
    if (!workOrder) return;

    setIsSaving(true);
    try {
      // Treat "assigned" as a UI-only concept.
      // DB status does NOT include assigned; it’s derived from assigned_staff_id.
      const statusToSave =
        editData.status === "in-progress" ? "pending" : editData.status;

      const payload = {
        status: statusToSave,
        assigned_staff_id: editData.assignedTo && editData.assignedTo !== "all" ? editData.assignedTo : null,
        scheduledDate: editData.scheduledDate ? editData.scheduledDate : null, // send yyyy-mm-dd
        estimatedCost: editData.estimatedCost || 0,
        actualCost: editData.actualCost || 0,

        // your rule: actualCost is source of truth
        paymentRequestAmount: editData.actualCost > 0 ? editData.actualCost : null,

        // keep unpaid until Stripe later
        paymentStatus: "unpaid",
      };

      const res = await fetch(`/api/admin/work-orders/${workOrder._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed (${res.status}): ${text}`);
      }

      toast({
        title: "Work Order Updated",
        description: "Saved successfully.",
      });

      setIsEditing(false);
      await loadWorkOrder();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChargeSavedCard = async () => {
    if (!workOrder?._id) return;

    setIsChargingCard(true);
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrder._id}/charge`, {
        method: "POST",
        credentials: "include",
      });
      
      const data = await res.json();

      console.log(data)

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Charge failed");
      }

      toast({
        title: "Payment Successful",
        description: "The selected saved card was charged successfully.",
      });

      await loadWorkOrder();
    } catch (e) {
      console.error(e);
      toast({
        title: "Charge Failed",
        description: e instanceof Error ? e.message : "Could not charge the selected card.",
        variant: "destructive",
      });
    } finally {
      setIsChargingCard(false);
    }
  };

  const handleSendPaymentRequest = async () => {
    if (!workOrder) return;

    const cost = workOrder.actualCost || 0;
    if (cost <= 0) {
      toast({
        title: "Error",
        description: "Set an actual cost before sending a payment request.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingPaymentRequest(true);
    try {
      const paymentAmount =
        editData.paymentRequestAmount > 0 ? editData.paymentRequestAmount : cost;

      const res = await fetch(`/api/admin/work-orders/${workOrder._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentRequestedDate: new Date().toISOString(),
          paymentRequestAmount: paymentAmount,
          paymentStatus: "unpaid",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Payment request failed (${res.status}): ${text}`);
      }

      // After updating work order payment fields

      await notificationService.createAdminNotification({
        notificationType: "PAYMENT_REQUEST",
        residentId: workOrder.resident_id,
        residentName: workOrder.ownerName,
        residentEmail: workOrder.ownerEmail,
        unitNumber: workOrder.unitNumber,
        message: `Payment request for ${workOrder.title}: $${paymentAmount.toFixed(2)}`,
      });

      toast({
        title: "Payment Request Sent",
        description: `Requested $${paymentAmount.toFixed(2)} from resident.`,
      });

      await loadWorkOrder();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to send payment request.",
        variant: "destructive",
      });
    } finally {
      setIsSendingPaymentRequest(false);
    }
  };

  const getStatusColor = (status: WorkOrder['status']) => {
    const colors = {
      pending: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      // assigned: 'bg-primary text-primary-foreground border-primary-foreground/20',
      'in-progress': 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      completed: 'bg-primary text-primary-foreground border-primary-foreground/20',
      cancelled: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
    };
    return colors[status];
  };

  const getPriorityColor = (priority: WorkOrder['priority']) => {
    const colors = {
      low: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      medium: 'bg-secondary text-secondary-foreground border-secondary-foreground/20',
      high: 'bg-primary text-primary-foreground border-primary-foreground/20',
      urgent: 'bg-destructive text-destructiveforeground border-destructive/20',
    };
    return colors[priority];
  };

  const getStaffName = (staffId: string) => {
    return staffMembers.find((s) => s._id === staffId)?.full_name || staffId;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary">
        <AdminHeader />
        <div className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
          <p className="font-paragraph text-xl text-primary-foreground/80 text-center">Loading work order details...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-primary">
        <AdminHeader />
        <div className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
          <p className="font-paragraph text-xl text-primary-foreground/80 text-center">Work order not found.</p>
          <div className="text-center mt-8">
            <Button
              onClick={() => navigate('/AdminDashboard')}
              className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
            >
              Back to Admin Dashboard
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <AdminHeader />

      <main className="max-w-[100rem] mx-auto px-6 lg:px-12 py-16">
        <Button
          variant="ghost"
          onClick={() => navigate(role === 'admin' ? '/AdminDashboard' : '/Dashboard')}
          className="mb-8 text-primary-foreground hover:text-primary-foreground/80 font-paragraph"
        >
          <ArrowLeft className="mr-2" size={20} />
          Back to {role === 'admin' ? 'Admin Dashboard' : 'Dashboard'}
        </Button>

        <div className="bg-secondary rounded-3xl p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              <h1 className="font-heading text-4xl lg:text-5xl text-secondary-foreground mb-4">
                {workOrder.title}
              </h1>
              <div className="flex flex-wrap gap-3 mb-4">
                <Badge className={`${getStatusColor(workOrder.status)} border font-paragraph`}>
                  {workOrder.status.replace('-', ' ').toUpperCase()}
                </Badge>
                <Badge className={`${getPriorityColor(workOrder.priority)} border font-paragraph`}>
                  {workOrder.priority.toUpperCase()}
                </Badge>
                <Badge className="bg-secondary text-secondary-foreground border-secondary-foreground/20 font-paragraph">
                  {workOrder.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3 flex-wrap">
                {!isEditing && role === 'admin' ? (
                  <>
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
                    >
                      Edit Details
                    </Button>
                    {workOrder.actualCost && workOrder.actualCost > 0 && !workOrder.paymentRequestedDate && (
                      <Button
                        onClick={handleSendPaymentRequest}
                        disabled={isSendingPaymentRequest}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-paragraph flex items-center gap-2"
                      >
                        <Send size={18} />
                        {isSendingPaymentRequest ? 'Sending...' : 'Send Payment Request'}
                      </Button>
                    )}

                  </>
                ) : isEditing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditData({
                          status: workOrder.status,
                          assignedTo: workOrder.assigned_staff_id || '',
                          estimatedCost: workOrder.estimatedCost || 0,
                          actualCost: workOrder.actualCost || 0,
                          paymentRequestAmount: workOrder.paymentRequestAmount || 0,
                          scheduledDate: workOrder.scheduledDate ? format(new Date(workOrder.scheduledDate), 'yyyy-MM-dd') : '',
                        });
                      }}
                      variant="outline"
                      className="border-2 border-secondary-foreground text-secondary-foreground hover:bg-secondary-foreground hover:text-secondary font-paragraph"
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <h2 className="font-heading text-2xl text-secondary-foreground border-b border-secondary-foreground/20 pb-3">
                Request Information
              </h2>

              <div>
                <Label className="font-paragraph text-sm text-secondary-foreground/60">Description</Label>
                <p className="font-paragraph text-base text-secondary-foreground mt-1">{workOrder.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-paragraph text-sm text-secondary-foreground/60">Unit Number</Label>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">{workOrder.unitNumber}</p>
                </div>
              </div>

              <div>
                <Label className="font-paragraph text-sm text-secondary-foreground/60">Owner Name</Label>
                <p className="font-paragraph text-base text-secondary-foreground mt-1">{workOrder.ownerName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-paragraph text-sm text-secondary-foreground/60">Email</Label>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">{workOrder.ownerEmail}</p>
                </div>
                <div>
                  <Label className="font-paragraph text-sm text-secondary-foreground/60">Phone</Label>
                  <p className="font-paragraph text-base text-secondary-foreground mt-1">{workOrder.ownerPhone}</p>
                </div>
              </div>

              <div>
                <Label className="font-paragraph text-sm text-secondary-foreground/60">Created Date</Label>
                <p className="font-paragraph text-base text-secondary-foreground mt-1">
                  {workOrder._createdAt ? format(new Date(workOrder._createdAt), 'MMMM dd, yyyy') : 'N/A'}
                </p>
              </div>
            </div>

            {/* Management Details */}
            <div className="space-y-6">
              <h2 className="font-heading text-2xl text-secondary-foreground border-b border-secondary-foreground/20 pb-3">
                Management Details
              </h2>

              {isEditing && role === 'admin' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="font-paragraph text-sm text-secondary-foreground/60">
                      Status
                    </Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) => setEditData({ ...editData, status: value as WorkOrder['status'] })}
                    >
                      <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        {/* <SelectItem value="assigned">Assigned</SelectItem> */}
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assignedTo" className="font-paragraph text-sm text-secondary-foreground/60">
                      Assigned To
                    </Label>
                    <Select
                      value={editData.assignedTo || ''}
                      onValueChange={(value) => setEditData({ ...editData, assignedTo: value === '' ? '' : value })}
                    >
                      <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Unassigned</SelectItem>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff._id} value={staff._id}>
                            {staff.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate" className="font-paragraph text-sm text-secondary-foreground/60">
                      Scheduled Date
                    </Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={editData.scheduledDate}
                      onChange={(e) => setEditData({ ...editData, scheduledDate: e.target.value })}
                      className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedCost" className="font-paragraph text-sm text-secondary-foreground/60">
                        Estimated Cost
                      </Label>
                      <Input
                        id="estimatedCost"
                        type="number"
                        step="0.01"
                        value={editData.estimatedCost}
                        onChange={(e) => setEditData({ ...editData, estimatedCost: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="actualCost" className="font-paragraph text-sm text-secondary-foreground/60">
                        Actual Cost
                      </Label>
                      <Input
                        id="actualCost"
                        type="number"
                        step="0.01"
                        value={editData.actualCost}
                        onChange={(e) => setEditData({ ...editData, actualCost: parseFloat(e.target.value) || 0 })}
                        className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentRequestAmount" className="font-paragraph text-sm text-secondary-foreground/60">
                      Payment Request Amount (Optional - leave blank to use Actual Cost)
                    </Label>
                    <Input
                      id="paymentRequestAmount"
                      type="number"
                      step="0.01"
                      value={editData.paymentRequestAmount}
                      onChange={(e) => setEditData({ ...editData, paymentRequestAmount: parseFloat(e.target.value) || 0 })}
                      className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                      placeholder="Leave blank to use Actual Cost"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="font-paragraph text-sm text-secondary-foreground/60">Assigned To</Label>
                    <p className="font-paragraph text-base text-secondary-foreground mt-1">
                      {workOrder.assigned_staff_id ? getStaffName(workOrder.assigned_staff_id) : 'Not assigned'}
                    </p>
                  </div>

                  <div>
                    <Label className="font-paragraph text-sm text-secondary-foreground/60 flex items-center gap-2">
                      <Calendar size={16} />
                      Scheduled Date
                    </Label>
                    <p className="font-paragraph text-base text-secondary-foreground mt-1">
                      {workOrder.scheduledDate ? format(new Date(workOrder.scheduledDate), 'MMMM dd, yyyy') : 'Not scheduled'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="font-paragraph text-sm text-secondary-foreground/60 flex items-center gap-2">
                        <DollarSign size={16} />
                        Estimated Cost
                      </Label>
                      <p className="font-paragraph text-base text-secondary-foreground mt-1">
                        {workOrder.estimatedCost ? `$${workOrder.estimatedCost.toFixed(2)}` : 'Not estimated'}
                      </p>
                    </div>

                    <div>
                      <Label className="font-paragraph text-sm text-secondary-foreground/60 flex items-center gap-2">
                        <DollarSign size={16} />
                        Actual Cost
                      </Label>
                      <p className="font-paragraph text-base text-secondary-foreground mt-1">
                        {workOrder.actualCost ? `$${workOrder.actualCost.toFixed(2)}` : 'Not finalized'}
                      </p>
                    </div>
                  </div>

                  {workOrder.completedDate && (
                    <div>
                      <Label className="font-paragraph text-sm text-secondary-foreground/60">Completed Date</Label>
                      <p className="font-paragraph text-base text-secondary-foreground mt-1">
                        {format(new Date(workOrder.completedDate), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Payment Section */}
          {workOrder.actualCost && workOrder.actualCost > 0 && (
            <div className="mt-8 pt-8 border-t border-secondary-foreground/20">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <h3 className="font-heading text-2xl text-secondary-foreground mb-2">
                    Payment Information
                  </h3>

                  <p className="font-paragraph text-lg text-secondary-foreground/70">
                    Total Amount:{" "}
                    <span className="font-heading text-2xl text-secondary-foreground">
                      ${workOrder.actualCost.toFixed(2)}
                    </span>
                  </p>

                  <p className="font-paragraph text-base text-secondary-foreground/60 mt-1">
                    Status: {workOrder.paymentStatus.toUpperCase()}
                  </p>

                  {workOrder.selectedPaymentMethod ? (
                    <p className="font-paragraph text-base text-secondary-foreground/60 mt-1">
                      Selected Card: {workOrder.selectedPaymentMethod.brand.toUpperCase()} ••••{" "}
                      {workOrder.selectedPaymentMethod.last4}
                      {workOrder.selectedPaymentMethod.expMonth &&
                      workOrder.selectedPaymentMethod.expYear
                        ? ` (${workOrder.selectedPaymentMethod.expMonth}/${workOrder.selectedPaymentMethod.expYear})`
                        : ""}
                    </p>
                  ) : (
                    <p className="font-paragraph text-base text-secondary-foreground/60 mt-1">
                      Selected Card: None selected yet
                    </p>
                  )}

                  {workOrder.paymentRequestedDate && (
                    <p className="font-paragraph text-sm text-secondary-foreground/60 mt-2">
                      Payment Requested: {format(new Date(workOrder.paymentRequestedDate), "MMM dd, yyyy")}
                    </p>
                  )}

                  <div className="mt-4">
                    <Button
                      onClick={handleChargeSavedCard}
                      disabled={
                        isChargingCard ||
                        workOrder.paymentStatus === "paid" ||
                        !workOrder.selectedPaymentMethodId
                      }
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-paragraph"
                    >
                      {isChargingCard ? "Charging..." : "Charge Selected Card"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
