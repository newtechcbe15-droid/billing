import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB } from "@/lib/localDB";
import { exportToCSV, formatCurrency } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  TrendingUp, 
  Search, 
  Eye, 
  Printer, 
  Lock, 
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoicePrint } from "@/components/service-job/InvoicePrint";

const STATUS_COLOR_MAP: Record<string, string> = {
  Collected: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Working: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Ready: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  Return: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  Delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Delivered Return": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const StatusCell = ({ job, onSave }: { job: any, onSave: (id: string, status: string, reason?: string) => void }) => {
  const [draftStatus, setDraftStatus] = useState(job.status);
  const [draftReason, setDraftReason] = useState(job.returnReason || "");
  const isChanged = draftStatus !== job.status || (draftStatus === "Return" && draftReason !== (job.returnReason || ""));

  useEffect(() => {
    setDraftStatus(job.status);
  }, [job.status]);

  if (job.status === "Delivered" || job.status === "Delivered Return") {
    return (
      <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase gap-1 px-2 py-0.5 ${STATUS_COLOR_MAP[job.status] || ""}`}>
        <Lock className="w-2.5 h-2.5" /> {job.status}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select 
        value={draftStatus} 
        onChange={(e) => setDraftStatus(e.target.value)}
        className="border border-border/80 rounded-lg px-2 py-1 text-[10px] font-bold uppercase bg-background outline-none cursor-pointer hover:bg-muted"
      >
        <option value="Collected">Collected</option>
        <option value="Working">Working</option>
        <option value="Ready">Ready</option>
        <option value="Return">Return</option>
        {!["Collected", "Working", "Ready", "Return", "Delivered", "Delivered Return"].includes(job.status) && (
          <option value={job.status}>{job.status}</option>
        )}
      </select>
      {draftStatus === "Return" && (
        <Input 
          type="text" 
          value={draftReason} 
          onChange={(e) => setDraftReason(e.target.value)} 
          placeholder="Reason for return..." 
          className="h-6 w-28 text-[10px] px-1.5"
        />
      )}
      {isChanged && (
        <Button 
          size="sm" 
          onClick={() => onSave(job.id, draftStatus, draftReason)}
          className="h-6 px-2 text-[10px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded"
        >
          Save
        </Button>
      )}
    </div>
  );
};

interface ReportRow {
  id: string;
  bill_number: string;
  created_at: string;
  device_type: "Mobile" | "Laptop" | "PC";
  brand: string;
  model: string;
  complaint: string;
  status: string;
  technician_assigned: string;
  delivered_by?: string;
  device_password_pin?: string;
  accessories_received?: string[];
  customers: {
    name: string;
    mobile_number: string;
    address?: string;
  };
  payments: {
    estimated_amount: number;
    advance_paid: number;
    amount_collected: number;
    discount: number;
    tax_percentage: number;
    balance_due: number;
    payment_status: "Paid" | "Partially Paid" | "Unpaid";
  } | null;
  warranties: {
    warranty_duration: string;
    warranty_expiry_date: string | null;
    warranty_status: string;
  } | null;
}

export default function Reports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters
  const [timeframe, setTimeframe] = useState<"all" | "today" | "month" | "year">("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [globalSearch, setGlobalSearch] = useState<string>(searchParams.get("q") || "");
  
  // Modals
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printJob, setPrintJob] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Sync URL search param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) {
      setGlobalSearch(q);
    }
  }, [searchParams]);

  // Query Master Reports Data
  const { data: reportsData = [], isLoading } = useQuery({
    queryKey: ["reportsLedgerMaster"],
    queryFn: async () => {
      const [jobs, customers, payments, warranties] = await Promise.all([
        localDB.jobs.getAll(),
        localDB.customers.getAll(),
        localDB.payments.getAll(),
        localDB.warranties.getAll()
      ]);

      const enrichedJobs = jobs.map((job: any) => ({
        ...job,
        customers: customers.find((c: any) => c.id === job.customer_id) || null,
        payments: payments.find((p: any) => p.job_id === job.id) || null,
        warranties: warranties.find((w: any) => w.job_id === job.id) || null
      }));

      enrichedJobs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return enrichedJobs as ReportRow[];
    }
  });

  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string, status: string, reason?: string }) => {
      const jobs = await localDB.jobs.getAll();
      const index = jobs.findIndex((j: any) => j.id === id);
      if (index > -1) {
        jobs[index].status = status;
        if (status === "Return" && reason !== undefined) {
          jobs[index].returnReason = reason;
        }
        await localDB.jobs.save(jobs);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reportsLedgerMaster"] });
    }
  });

  const handleStatusChange = (id: string, status: string, reason?: string) => {
    statusMutation.mutate({ id, status, reason });
  };

  const handleOpenView = (job: any) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleOpenPrint = (job: any) => {
    setPrintJob(job);
    setIsPrintModalOpen(true);
  };

  // Filter records
  const processedRecords = useMemo(() => {
    let dataset = [...reportsData];
    const todayStr = new Date().toISOString().split("T")[0];
    const currentYearStr = new Date().getFullYear().toString();
    const currentMonth = new Date().getMonth();

    if (timeframe === "today") {
      dataset = dataset.filter(r => r.created_at?.split("T")[0] === todayStr);
    } else if (timeframe === "month") {
      dataset = dataset.filter(r => {
        const d = new Date(r.created_at);
        return d.getMonth() === currentMonth && d.getFullYear().toString() === currentYearStr;
      });
    } else if (timeframe === "year") {
      dataset = dataset.filter(r => r.created_at?.startsWith(currentYearStr));
    }

    if (deviceFilter !== "ALL") {
      dataset = dataset.filter(r => r.device_type === deviceFilter);
    }

    if (statusFilter !== "ALL") {
      dataset = dataset.filter(r => r.status === statusFilter);
    }

    if (globalSearch.trim()) {
      const target = globalSearch.toLowerCase().trim();
      dataset = dataset.filter(r => 
        r.bill_number?.toLowerCase().includes(target) ||
        (r.customers?.name || "").toLowerCase().includes(target) ||
        (r.customers?.mobile_number || "").toLowerCase().includes(target) ||
        r.brand?.toLowerCase().includes(target) ||
        r.model?.toLowerCase().includes(target) ||
        ((r as any).imei_serial_number || "").toLowerCase().includes(target)
      );
    }

    return dataset;
  }, [reportsData, timeframe, deviceFilter, statusFilter, globalSearch]);

  // Financial calculations
  const financialSummary = useMemo(() => {
    let totalGrossReceipts = 0;
    let totalOutstandingDue = 0;
    let completeDeliveredCount = 0;

    processedRecords.forEach(rec => {
      if (rec.payments) {
        totalGrossReceipts += ((rec.payments.advance_paid || 0) + (rec.payments.amount_collected || 0));
        totalOutstandingDue += (rec.payments.balance_due || 0);
      }
      if (rec.status === "Delivered") {
        completeDeliveredCount++;
      }
    });

    return { totalGrossReceipts, totalOutstandingDue, completeDeliveredCount };
  }, [processedRecords]);

  // Revenue by timeframe
  const revenueSummary = useMemo(() => {
    let day = 0, week = 0, month = 0, year = 0;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    reportsData.forEach(r => {
      if (!r.payments) return;
      const addRev = (amt: number, dtStr: string) => {
        if (!amt || !dtStr) return;
        const d = new Date(dtStr);
        if (dtStr.startsWith(todayStr)) day += amt;
        if (d >= startOfWeek) week += amt;
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) month += amt;
        if (d.getFullYear() === currentYear) year += amt;
      };

      addRev(r.payments.advance_paid, r.created_at.split("T")[0]);
      addRev(r.payments.amount_collected, (r.payments as any).payment_date || r.created_at.split("T")[0]);
    });

    return { day, week, month, year };
  }, [reportsData]);

  // Export CSV
  const triggerSpreadsheetExport = () => {
    const formatted = processedRecords.map(r => ({
      "Bill Number": r.bill_number,
      "Log Date": new Date(r.created_at).toLocaleDateString("en-IN"),
      "Customer Name": r.customers?.name || "N/A",
      "Contact Phone": r.customers?.mobile_number || "N/A",
      "Asset Type": r.device_type,
      "Model Profile": `${r.brand} ${r.model}`,
      "Operational Status": r.status,
      "Technician Assigned": r.technician_assigned,
      "Net Receipts collected (INR)": ((r.payments?.advance_paid || 0) + (r.payments?.amount_collected || 0)),
      "Outstanding Remainder Due (INR)": r.payments?.balance_due || 0,
      "Payment Status Mapping": r.payments?.payment_status || "Unpaid"
    }));
    exportToCSV(formatted, `NTCS_Financial_Ledger_Report_${timeframe.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Master Ledger & Audit Reports
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time financial summaries, ticket registries, and customer service audits.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button 
            onClick={triggerSpreadsheetExport} 
            disabled={processedRecords.length === 0}
            className="text-xs font-bold gap-2 h-10 px-4 rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      {/* KPI Revenue Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", val: revenueSummary.day, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "This Week", val: revenueSummary.week, icon: Calendar, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "This Month", val: revenueSummary.month, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "This Year", val: revenueSummary.year, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card key={idx} className="cockpit-card rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </span>
                <div className={`p-1.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-foreground">
                {formatCurrency(kpi.val)}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Secondary Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Filtered Revenue
            </span>
            <span className="text-xl font-black font-mono text-emerald-500">
              {formatCurrency(financialSummary.totalGrossReceipts)}
            </span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Collected</span>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Pending Balance
            </span>
            <span className="text-xl font-black font-mono text-rose-500">
              {formatCurrency(financialSummary.totalOutstandingDue)}
            </span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Receivable</span>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Delivered Units
            </span>
            <span className="text-xl font-black font-mono text-primary">
              {financialSummary.completeDeliveredCount} Units
            </span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Completed</span>
        </Card>
      </div>

      {/* Filter Toolbar Card */}
      <Card className="cockpit-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Timeframe selector pills */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
            {(["all", "today", "month", "year"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  timeframe === tf
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf === "all" ? "All Time" : tf === "today" ? "Today" : tf === "month" ? "This Month" : "This Year"}
              </button>
            ))}
          </div>

          {/* Device and Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="border border-border/80 rounded-xl px-2.5 py-1 text-xs font-semibold bg-background h-8 outline-none"
            >
              <option value="ALL">All Devices</option>
              <option value="Mobile">Mobile</option>
              <option value="Laptop">Laptop</option>
              <option value="PC">PC</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border/80 rounded-xl px-2.5 py-1 text-xs font-semibold bg-background h-8 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Collected">Collected</option>
              <option value="Working">Working</option>
              <option value="Ready">Ready</option>
              <option value="Return">Return</option>
              <option value="Delivered">Delivered</option>
              <option value="Delivered Return">Delivered Return</option>
            </select>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports by Bill #, Customer Name, Mobile, or Model..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-background"
          />
        </div>
      </Card>

      {/* Primary Data Table */}
      <Card className="cockpit-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ticket Ledger ({processedRecords.length} Records)
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/80 hover:bg-transparent">
                <TableHead className="text-xs font-bold uppercase py-3.5">Bill #</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Customer</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Asset</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Defect</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Pipeline Status</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5 text-right">Collected</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5 text-right">Balance Due</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={8} className="py-4">
                      <div className="h-6 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : processedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                    No matching service tickets found for active filter constraints.
                  </TableCell>
                </TableRow>
              ) : (
                processedRecords.map((job) => {
                  const collected = (job.payments?.advance_paid || 0) + (job.payments?.amount_collected || 0);
                  const balance = job.payments?.balance_due || 0;
                  return (
                    <TableRow key={job.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors text-xs">
                      <TableCell className="font-mono font-bold text-foreground">
                        #{job.bill_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground">{job.customers?.name || "Client"}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{job.customers?.mobile_number}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{job.brand} {job.model}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">{job.device_type}</div>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {job.complaint}
                      </TableCell>
                      <TableCell>
                        <StatusCell job={job} onSave={handleStatusChange} />
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(collected)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-rose-500">
                        {balance > 0 ? formatCurrency(balance) : "₹0.00"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenView(job)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                            title="View Inspection Dossier"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenPrint(job)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                            title="Print Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Ticket Details View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase text-foreground">
              Ticket Details #{selectedJob?.bill_number}
            </DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-xl border border-border/60">
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground font-bold block">Customer</span>
                  <p className="font-bold text-foreground">{selectedJob.customers?.name}</p>
                  <p className="font-mono text-muted-foreground">{selectedJob.customers?.mobile_number}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold block">Device</span>
                  <p className="font-bold text-foreground">{selectedJob.brand} {selectedJob.model}</p>
                  <p className="text-muted-foreground capitalize">{selectedJob.device_type}</p>
                </div>
              </div>

              <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground font-bold block">Defect</span>
                <p className="font-medium text-foreground">{selectedJob.complaint}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-center">
                <div>
                  <span className="text-[9px] uppercase text-muted-foreground font-bold block">Estimate</span>
                  <p className="font-bold">₹{selectedJob.payments?.estimated_amount || 0}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-muted-foreground font-bold block">Advance</span>
                  <p className="font-bold text-emerald-500">₹{selectedJob.payments?.advance_paid || 0}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-muted-foreground font-bold block">Balance</span>
                  <p className="font-bold text-rose-500">₹{selectedJob.payments?.balance_due || 0}</p>
                </div>
              </div>

              {selectedJob.payments?.payment_method === "Split" && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    Split Payment Method Breakdown
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-center font-mono">
                    <div className="p-2 rounded-lg bg-background/80 border border-border/40">
                      <span className="text-[9px] uppercase text-muted-foreground font-bold block">Cash Split</span>
                      <p className="font-bold text-emerald-500 text-sm">₹{selectedJob.payments?.split_cash || 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background/80 border border-border/40">
                      <span className="text-[9px] uppercase text-muted-foreground font-bold block">GPay / UPI Split</span>
                      <p className="font-bold text-blue-500 text-sm">₹{selectedJob.payments?.split_gpay || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
            <Button 
              size="sm" 
              onClick={() => { setIsModalOpen(false); navigate(`/edit-job/${selectedJob?.id}`); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Edit Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="text-xs font-black uppercase text-foreground">Print Preview</DialogTitle>
          </DialogHeader>
          {printJob && (
            <div className="border rounded-xl p-4 bg-white text-black">
              <InvoicePrint
                companySettings={{
                  company_name: "NEW TECHNOLOGY Mobile and Laptop Service Centre",
                  address: "Singanallur, Coimbatore, Tamil Nadu",
                  phone: "+91 98422 12345",
                  terms_conditions: "All repair works carry checking warranty."
                }}
                jobDetails={{
                  bill_number: printJob.bill_number,
                  created_at: printJob.created_at,
                  device_type: printJob.device_type,
                  brand: printJob.brand,
                  model: printJob.model,
                  imei_serial_number: printJob.imei_serial_number || "",
                  accessories_received: printJob.accessories_received || [],
                  device_condition: printJob.device_condition || "",
                  complaint: printJob.complaint,
                  technician_assigned: printJob.technician_assigned || "Suresh",
                  estimated_delivery_date: printJob.estimated_delivery_date || "",
                  status: printJob.status,
                  billed_by: printJob.billed_by || "Suresh",
                  customers: {
                    name: printJob.customers?.name || "",
                    mobile_number: printJob.customers?.mobile_number || "",
                    address: printJob.customers?.address || "",
                  },
                  payments: {
                    estimated_amount: printJob.payments?.estimated_amount || 0,
                    advance_paid: printJob.payments?.advance_paid || 0,
                    amount_collected: printJob.payments?.amount_collected || 0,
                    discount: printJob.payments?.discount || 0,
                    tax_percentage: printJob.payments?.tax_percentage || 0,
                    balance_due: printJob.payments?.balance_due || 0,
                    payment_method: printJob.payments?.payment_method || "Cash",
                  }
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>Close</Button>
            <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              <Printer className="w-4 h-4 mr-1.5" /> Print Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}