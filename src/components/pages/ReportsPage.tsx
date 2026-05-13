"use client";

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "@/components/layout/AdminHeader";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { WorkOrder } from "@/types/workorder";

export default function ReportsPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState({
    unitNumber: "",
    status: "all",
    priority: "all",
    paymentStatus: "all",
    assignedStaffId: "all",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  async function loadWorkOrders() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/work-orders", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load reports data");
      setWorkOrders(data.items || []);
    } catch (e) {
      console.error(e);
      setWorkOrders([]);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return workOrders.filter((order) => {
      const createdAt = order._createdAt ? new Date(order._createdAt) : null;

      if (filters.unitNumber && !(order.unitNumber || "").toLowerCase().includes(filters.unitNumber.toLowerCase())) {
        return false;
      }

      if (filters.status !== "all" && order.status !== filters.status) {
        return false;
      }

      if (filters.priority !== "all" && order.priority !== filters.priority) {
        return false;
      }

      if (
        filters.paymentStatus !== "all" &&
        (order.paymentStatus || "unpaid").toLowerCase() !== filters.paymentStatus
      ) {
        return false;
      }

      if (filters.assignedStaffId !== "all") {
        if (filters.assignedStaffId === "unassigned") {
          if (order.assigned_staff_id) return false;
        } else if ((order.assigned_staff_id || "") !== filters.assignedStaffId) {
          return false;
        }
      }

      if (filters.dateFrom && createdAt && createdAt < new Date(filters.dateFrom)) {
        return false;
      }

      if (filters.dateTo && createdAt) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (createdAt > end) return false;
      }

      return true;
    });
  }, [workOrders, filters]);

  const summary = useMemo(() => {
    const totalRequests = filteredOrders.length;
    const pending = filteredOrders.filter((o) => o.status === "pending").length;
    const completed = filteredOrders.filter((o) => o.status === "completed").length;
    const cancelled = filteredOrders.filter((o) => o.status === "cancelled").length;

    const totalActualCost = filteredOrders.reduce(
      (sum, o) => sum + Number(o.actualCost ?? 0),
      0
    );

    const totalProcessingFees = filteredOrders.reduce(
      (sum, o) => sum + Number(o.processingFee ?? 0),
      0
    );

    const totalCharged = filteredOrders.reduce(
      (sum, o) =>
        sum +
        Number(
          o.totalChargeAmount ??
            (Number(o.actualCost ?? 0) + Number(o.processingFee ?? 0))
        ),
      0
    );

    const totalPaid = filteredOrders
      .filter((o) => (o.paymentStatus || "").toLowerCase() === "paid")
      .reduce(
        (sum, o) =>
          sum +
          Number(
            o.totalChargeAmount ??
              (Number(o.actualCost ?? 0) + Number(o.processingFee ?? 0))
          ),
        0
      );

    const outstanding = filteredOrders
      .filter((o) => (o.paymentStatus || "unpaid").toLowerCase() !== "paid")
      .reduce(
        (sum, o) =>
          sum +
          Number(
            o.totalChargeAmount ??
              (Number(o.actualCost ?? 0) + Number(o.processingFee ?? 0))
          ),
        0
      );

    return {
      totalRequests,
      pending,
      completed,
      cancelled,
      totalActualCost,
      totalProcessingFees,
      totalCharged,
      totalPaid,
      outstanding,
    };
  }, [filteredOrders]);

  const unitSummary = useMemo(() => {
    const map = new Map<string, any>();

    for (const order of filteredOrders) {
      const unit = order.unitNumber || "Unknown";

      if (!map.has(unit)) {
        map.set(unit, {
          unitNumber: unit,
          requestsSubmitted: 0,
          pending: 0,
          completed: 0,
          cancelled: 0,
          totalActualCost: 0,
          totalProcessingFees: 0,
          totalCharged: 0,
          totalPaid: 0,
          outstanding: 0,
        });
      }

      const row = map.get(unit);
      const actualCost = Number(order.actualCost ?? 0);
      const processingFee = Number(order.processingFee ?? 0);
      const totalCharge =
        Number(order.totalChargeAmount ?? actualCost + processingFee);

      row.requestsSubmitted += 1;
      if (order.status === "pending") row.pending += 1;
      if (order.status === "completed") row.completed += 1;
      if (order.status === "cancelled") row.cancelled += 1;

      row.totalActualCost += actualCost;
      row.totalProcessingFees += processingFee;
      row.totalCharged += totalCharge;

      if ((order.paymentStatus || "").toLowerCase() === "paid") {
        row.totalPaid += totalCharge;
      } else {
        row.outstanding += totalCharge;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber)
    );
  }, [filteredOrders]);

  function exportCsv(filename: string, rows: Record<string, any>[]) {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const workOrderExportRows = filteredOrders.map((o) => ({
    id: o._id,
    title: o.title,
    unitNumber: o.unitNumber,
    ownerName: o.ownerName,
    status: o.status,
    priority: o.priority,
    assignedStaffId: o.assigned_staff_id || "",
    createdAt: o._createdAt || "",
    completedDate: o.completedDate || "",
    actualCost: Number(o.actualCost ?? 0).toFixed(2),
    processingFee: Number(o.processingFee ?? 0).toFixed(2),
    totalChargeAmount: Number(
      o.totalChargeAmount ??
        (Number(o.actualCost ?? 0) + Number(o.processingFee ?? 0))
    ).toFixed(2),
    paymentStatus: o.paymentStatus || "unpaid",
  }));

  const assignedStaffOptions = useMemo(() => {
    const ids = Array.from(
      new Set(
        workOrders
          .map((o) => o.assigned_staff_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    return ids.sort();
  }, [workOrders]);

  return (
    <div className="min-h-screen bg-primary">
      <AdminHeader />
      <main className="max-w-[120rem] mx-auto px-6 lg:px-12 py-16">
        <div className="mb-10">
          <h1 className="font-heading text-5xl text-primary-foreground mb-4">
            Reports
          </h1>
          <p className="font-paragraph text-lg text-primary-foreground/80">
            Filter, review, and export Warwick work order and unit summaries.
          </p>
        </div>

                <div className="mb-8">
          <Link to="/AdminDashboard">
            <Button
              variant="outline"
              className="font-paragraph bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>

        <div className="bg-secondary rounded-3xl p-6 lg:p-8 mb-8">
          <h2 className="font-heading text-2xl text-secondary-foreground mb-6">
            Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Filter by unit number"
              value={filters.unitNumber}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, unitNumber: e.target.value }))
              }
              className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
            />

            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.priority}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, priority: value }))
              }
            >
              <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.paymentStatus}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, paymentStatus: value }))
              }
            >
              <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.assignedStaffId}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, assignedStaffId: value }))
              }
            >
              <SelectTrigger className="bg-secondary border-secondary-foreground/20 text-secondary-foreground">
                <SelectValue placeholder="Assigned Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignments</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignedStaffOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
              }
              className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
            />

            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
              }
              className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
            />

            <Button
              onClick={() =>
                setFilters({
                  unitNumber: "",
                  status: "all",
                  priority: "all",
                  paymentStatus: "all",
                  assignedStaffId: "all",
                  dateFrom: "",
                  dateTo: "",
                })
              }
              className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Total Requests</p>
            <p className="font-heading text-3xl text-secondary-foreground">{summary.totalRequests}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Pending</p>
            <p className="font-heading text-3xl text-secondary-foreground">{summary.pending}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Completed</p>
            <p className="font-heading text-3xl text-secondary-foreground">{summary.completed}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Cancelled</p>
            <p className="font-heading text-3xl text-secondary-foreground">{summary.cancelled}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Outstanding</p>
            <p className="font-heading text-3xl text-secondary-foreground">${summary.outstanding.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Actual Cost Total</p>
            <p className="font-heading text-3xl text-secondary-foreground">${summary.totalActualCost.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Processing Fees</p>
            <p className="font-heading text-3xl text-secondary-foreground">${summary.totalProcessingFees.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Total Charged</p>
            <p className="font-heading text-3xl text-secondary-foreground">${summary.totalCharged.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-3xl p-6">
            <p className="font-paragraph text-sm text-secondary-foreground/60 mb-2">Total Paid</p>
            <p className="font-heading text-3xl text-secondary-foreground">${summary.totalPaid.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            onClick={() => exportCsv("work-orders-report.csv", workOrderExportRows)}
            className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
            disabled={!workOrderExportRows.length}
          >
            Export Work Orders CSV
          </Button>

          <Button
            onClick={() => exportCsv("unit-summary-report.csv", unitSummary)}
            className="bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph"
            disabled={!unitSummary.length}
          >
            Export Unit Summary CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <p className="font-paragraph text-xl text-primary-foreground/80">
              Loading reports...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-secondary rounded-3xl p-6 lg:p-8 overflow-x-auto">
              <h2 className="font-heading text-2xl text-secondary-foreground mb-6">
                Work Orders Report
              </h2>

              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-secondary-foreground/20 text-left">
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Title</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Unit</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Owner</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Status</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Priority</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Actual Cost</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Fee</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Total</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Payment</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order._id} className="border-b border-secondary-foreground/10">
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.title}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.unitNumber || "N/A"}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.ownerName || "N/A"}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.status}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.priority}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${Number(order.actualCost ?? 0).toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${Number(order.processingFee ?? 0).toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">
                        ${Number(order.totalChargeAmount ?? (Number(order.actualCost ?? 0) + Number(order.processingFee ?? 0))).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{order.paymentStatus || "unpaid"}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">
                        {order._createdAt ? format(new Date(order._createdAt), "MMM dd, yyyy") : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-secondary rounded-3xl p-6 lg:p-8 overflow-x-auto">
              <h2 className="font-heading text-2xl text-secondary-foreground mb-6">
                Unit Summary Report
              </h2>

              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-secondary-foreground/20 text-left">
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Unit</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Submitted</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Pending</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Completed</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Cancelled</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Actual Cost</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Fees</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Total Charged</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Paid</th>
                    <th className="py-3 pr-4 font-paragraph text-secondary-foreground/70">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {unitSummary.map((row) => (
                    <tr key={row.unitNumber} className="border-b border-secondary-foreground/10">
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{row.unitNumber}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{row.requestsSubmitted}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{row.pending}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{row.completed}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">{row.cancelled}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${row.totalActualCost.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${row.totalProcessingFees.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${row.totalCharged.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${row.totalPaid.toFixed(2)}</td>
                      <td className="py-3 pr-4 font-paragraph text-secondary-foreground">${row.outstanding.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}