import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB } from "@/lib/localDB";
import { exportToCSV, formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  TrendingUp, 
  ShieldAlert, 
  Clock,
  Layers,
  Eye,
  FileText,
  Phone,
  User,
  MonitorSmartphone,
  Truck,
  Lock,
  BadgeCheck,
  Receipt
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const StatusCell = ({ job, onSave }: { job: any, onSave: (id: string, status: string, reason?: string) => void }) => {
  const [draftStatus, setDraftStatus] = useState(job.status);
  const [draftReason, setDraftReason] = useState(job.returnReason || "");
  const isChanged = draftStatus !== job.status || (draftStatus === "Return" && draftReason !== (job.returnReason || ""));

  // Sync draft if job.status updates from parent/server
  useEffect(() => {
    setDraftStatus(job.status);
  }, [job.status]);

  if (job.status === "Delivered" || job.status === "Delivered Return") {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase">
        <Lock className="w-3 h-3" /> {job.status}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select 
        value={draftStatus} 
        onChange={(e) => setDraftStatus(e.target.value)}
        className="border rounded px-2 py-1 text-[10px] font-bold uppercase bg-transparent outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900"
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
        <input 
          type="text" 
          value={draftReason} 
          onChange={(e) => setDraftReason(e.target.value)} 
          placeholder="Reason for return..." 
          className="border rounded px-2 py-1 text-[10px] w-32 outline-none h-6"
        />
      )}
      {isChanged && (
        <Button 
          size="sm" 
          onClick={() => onSave(job.id, draftStatus, draftReason)}
          className="h-6 px-2 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
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

  // Analytical State Management Filter Hooks
  const [timeframe, setTimeframe] = useState<"all" | "today" | "month" | "year">("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  
  // View Modal State
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Master Pipeline Query Ledger Fetch Execution
  const { data: reportsData = [], isLoading, error } = useQuery({
    queryKey: ["reportsLedgerMaster"],
    queryFn: async () => {
      const jobs = await localDB.jobs.getAll();
      const customers = await localDB.customers.getAll();
      const payments = await localDB.payments.getAll();
      const warranties = await localDB.warranties.getAll();

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

  // 2. High-Performance Multi-Pass Filter Calculation Matrix via useMemo
  const processedRecords = useMemo(() => {
    let dataset = [...reportsData];
    const todayStr = new Date().toISOString().split("T")[0];
    const currentYearStr = new Date().getFullYear().toString(); // 2026 Context
    const currentMonth = new Date().getMonth();

    // Pass A: Temporal Timeframe Sorting Bounds
    if (timeframe === "today") {
      dataset = dataset.filter(r => r.created_at.split("T")[0] === todayStr);
    } else if (timeframe === "month") {
      dataset = dataset.filter(r => {
        const d = new Date(r.created_at);
        return d.getMonth() === currentMonth && d.getFullYear().toString() === currentYearStr;
      });
    } else if (timeframe === "year") {
      dataset = dataset.filter(r => r.created_at.startsWith(currentYearStr));
    }

    // Pass B: Device Vector Classification
    if (deviceFilter !== "ALL") {
      dataset = dataset.filter(r => r.device_type === deviceFilter);
    }

    // Pass C: Workflow Pipeline Milestone Filter
    if (statusFilter !== "ALL") {
      dataset = dataset.filter(r => r.status === statusFilter);
    }

    return dataset;
  }, [reportsData, timeframe, deviceFilter, statusFilter]);

  // 3. Dynamic Accounting Ledger Summaries Calculator Component Loop
  const financialSummary = useMemo(() => {
    let totalGrossReceipts = 0;
    let totalOutstandingDue = 0;
    let completeDeliveredCount = 0;

    processedRecords.forEach(rec => {
      if (rec.payments) {
        totalGrossReceipts += (rec.payments.advance_paid + rec.payments.amount_collected);
        totalOutstandingDue += rec.payments.balance_due;
      }
      if (rec.status === "Delivered") {
        completeDeliveredCount++;
      }
    });

    return { totalGrossReceipts, totalOutstandingDue, completeDeliveredCount };
  }, [processedRecords]);

  // Comprehensive Revenue Summary
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

  // 4. Client Side Dynamic Excel/CSV Binary Extraction Stream Generator Routine
  const triggerSpreadsheetExport = () => {
    const formattedExportPayload = processedRecords.map(r => ({
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
{/* ... */}
    exportToCSV(formattedExportPayload, `NTCS_Financial_Ledger_Report_${timeframe.toUpperCase()}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto min-h-screen relative z-10">
      {/* HEADER COCKPIT ACTION CONTROLS SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-500">Service Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">View finances, performance stats, and job logs.</p>
        </div>
        <Button 
          onClick={triggerSpreadsheetExport} 
          disabled={processedRecords.length === 0}
          className="text-xs font-bold gap-2 h-10 px-4 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg self-stretch sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
          Export to CSV
        </Button>
      </div>

      {/* REVENUE SUMMARY BLOCKS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-white dark:bg-zinc-900">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(revenueSummary.day)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Today's Revenue</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-white dark:bg-zinc-900">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(revenueSummary.week)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Weekly Revenue</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-white dark:bg-zinc-900">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-violet-500" /> This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrency(revenueSummary.month)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Monthly Revenue</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border bg-white dark:bg-zinc-900">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> This Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(revenueSummary.year)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Annual Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER CONTROLLER BAR BLOCK CONTAINER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-border shadow-sm">
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)} className="w-full border rounded-lg text-xs font-semibold p-2 bg-background text-foreground h-9 shadow-sm">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">Device Type</label>
          <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className="w-full border rounded-lg text-xs font-semibold p-2 bg-background text-foreground h-9 shadow-sm">
            <option value="ALL">All Devices</option>
            <option value="Mobile">Mobile</option>
            <option value="Laptop">Laptop</option>
            <option value="PC">PC</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border rounded-lg text-xs font-semibold p-2 bg-background text-foreground h-9 shadow-sm">
            <option value="ALL">All Statuses</option>
            <option value="Received">Received</option>
            <option value="On Working">On Working</option>
            <option value="Completed">Completed</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
          </select>
        </div>
      </div>

      {/* ACCOUNTING SUMMARY METRIC FLASH GRID DISPLAY BLOCK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-none border-border">
          <CardHeader className="pb-1.5"><CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-500"/> Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(financialSummary.totalGrossReceipts)}</div></CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardHeader className="pb-1.5"><CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-rose-500"/> Pending Balance</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(financialSummary.totalOutstandingDue)}</div></CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardHeader className="pb-1.5"><CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500"/> Completed Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-slate-800 dark:text-zinc-200">{financialSummary.completeDeliveredCount} Jobs Delivered</div></CardContent>
        </Card>
      </div>

      {/* COMPREHENSIVE FLATTENED DATA MATRIX REPORT SHEET */}
      <Card className="shadow-sm border-border bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-zinc-500" />
            Job Reports ({processedRecords.length})
          </h3>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Bill No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Complaint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery Status</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  {Array.from({ length: 9 }).map((_, cIdx) => (
                    <TableCell key={cIdx} className="py-4">
                      <div className="h-4 bg-muted/60 animate-pulse rounded w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-xs font-semibold text-rose-500">
                  <div className="flex flex-col items-center gap-1.5">
                    <ShieldAlert className="w-6 h-6" />
                    Failed to load reports: {(error as Error).message}
                  </div>
                </TableCell>
              </TableRow>
            ) : processedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-xs font-medium text-muted-foreground opacity-50">
                  No reports found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              processedRecords.map((row) => {
                const totalCollected = (row.payments?.advance_paid || 0) + (row.payments?.amount_collected || 0);
                return (
                  <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-mono font-bold text-xs text-foreground py-3.5">{row.bill_number}</TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-foreground/90">{row.customers?.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{row.customers?.mobile_number}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-foreground/80">{row.brand}</span> <span className="opacity-60 text-xs">{row.model}</span>
                      <div className="text-[9px] font-mono tracking-wide text-muted-foreground uppercase mt-0.5">{row.device_type}</div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                      {row.complaint || <span className="opacity-50">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusCell job={row} onSave={handleStatusChange} />
                    </TableCell>
                    <TableCell>
                      {["Delivered", "Delivered Return"].includes(row.status) ? (
                        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {row.status} <span className="opacity-70 font-medium lowercase">by {row.delivered_by || "Unknown"}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-muted-foreground">Pending</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCollected)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                      {row.payments?.balance_due && row.payments.balance_due > 0 ? formatCurrency(row.payments.balance_due) : <span className="text-zinc-300 dark:text-zinc-700 font-normal text-[11px]">—</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/delivery?search=${row.bill_number}`)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold gap-1 h-8 px-2 rounded-md"
                        title="Process Delivery"
                      >
                        <Truck className="w-3.5 h-3.5 stroke-[2.2]" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenView(row)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold gap-1 h-8 px-2 rounded-md"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* READ-ONLY VIEW MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Job Details: {selectedJob?.bill_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete read-only overview of the service job.
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4 my-2 max-h-[70vh] overflow-y-auto pr-2">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-none bg-slate-50/50 dark:bg-zinc-900/30 border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3 border-b pb-2"><User className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Customer Info</span></div>
                    <p className="text-sm font-bold">{selectedJob.customers?.name}</p>
                    <p className="text-xs font-mono"><Phone className="w-3 h-3 inline mr-1 opacity-70"/> {selectedJob.customers?.mobile_number}</p>
                    {selectedJob.customers?.address && <p className="text-xs mt-1 text-muted-foreground">{selectedJob.customers.address}</p>}
                  </CardContent>
                </Card>

                <Card className="shadow-none bg-slate-50/50 dark:bg-zinc-900/30 border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3 border-b pb-2"><MonitorSmartphone className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Device Info</span></div>
                    <p className="text-sm font-bold">{selectedJob.brand} {selectedJob.model}</p>
                    <p className="text-xs"><span className="opacity-70">Type:</span> {selectedJob.device_type}</p>
                    {(selectedJob.imei_serial_number || selectedJob.imeiSerialNumber) && <p className="text-xs font-mono"><span className="opacity-70">IMEI:</span> {selectedJob.imei_serial_number || selectedJob.imeiSerialNumber}</p>}
                    <p className="text-xs mt-1 text-muted-foreground"><span className="font-semibold text-foreground/70">Complaint:</span> {selectedJob.complaint}</p>
                    {selectedJob.device_password_pin && <p className="text-xs font-mono mt-1"><span className="opacity-70">Password/PIN:</span> {selectedJob.device_password_pin}</p>}
                    {selectedJob.accessories_received && selectedJob.accessories_received.length > 0 && (
                      <p className="text-xs mt-1"><span className="opacity-70">Accessories:</span> {selectedJob.accessories_received.join(", ")}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-none bg-slate-50/50 dark:bg-zinc-900/30 border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-3 border-b pb-2"><Receipt className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Financial Overview</span></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="opacity-70 mb-1">Estimated Cost</p>
                      <p className="font-bold font-mono">₹{selectedJob.payments?.estimated_amount || 0}</p>
                    </div>
                    <div>
                      <p className="opacity-70 mb-1">Advance Paid</p>
                      <p className="font-bold font-mono text-emerald-600">₹{selectedJob.payments?.advance_paid || 0}</p>
                    </div>
                    <div>
                      <p className="opacity-70 mb-1">Collected</p>
                      <p className="font-bold font-mono text-blue-600">₹{selectedJob.payments?.amount_collected || 0}</p>
                    </div>
                    <div>
                      <p className="opacity-70 mb-1">Current Status</p>
                      <p className="mt-1 font-bold text-[10px] uppercase">{selectedJob.status}</p>
                    </div>
                    
                    {selectedJob.payments?.payment_method === "Split" && (
                      <>
                        <div className="col-span-2 border-t pt-2 mt-1">
                          <p className="opacity-70 mb-1">Split (Cash)</p>
                          <p className="font-bold font-mono">₹{selectedJob.payments?.split_cash || 0}</p>
                        </div>
                        <div className="col-span-2 border-t pt-2 mt-1">
                          <p className="opacity-70 mb-1">Split (GPay)</p>
                          <p className="font-bold font-mono">₹{selectedJob.payments?.split_gpay || 0}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery and Warranty Info Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-none bg-slate-50/50 dark:bg-zinc-900/30 border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3 border-b pb-2">
                      <Truck className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Delivery Details</span>
                    </div>
                    {["Delivered", "Delivered Return"].includes(selectedJob.status) ? (
                      <>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{selectedJob.status}</p>
                        <p className="text-xs"><span className="opacity-70">Delivered By:</span> {selectedJob.delivered_by || "Unknown"}</p>
                        <p className="text-xs"><span className="opacity-70">Delivery Date:</span> {selectedJob.payments?.payment_date ? new Date(selectedJob.payments.payment_date).toLocaleDateString("en-IN") : "N/A"}</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground font-medium italic">Item has not been delivered yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-none bg-slate-50/50 dark:bg-zinc-900/30 border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3 border-b pb-2">
                      <BadgeCheck className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Warranty Info</span>
                    </div>
                    {selectedJob.warranties ? (
                      <>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{selectedJob.warranties.warranty_duration}</p>
                        <p className="text-xs"><span className="opacity-70">Status:</span> {selectedJob.warranties.warranty_status}</p>
                        {selectedJob.warranties.warranty_expiry_date && (
                          <p className="text-xs font-mono mt-1"><span className="opacity-70">Expiry Date:</span> {new Date(selectedJob.warranties.warranty_expiry_date).toLocaleDateString("en-IN")}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground font-medium italic">No warranty registered for this job.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between border-t pt-4 border-slate-200 dark:border-zinc-800">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="text-xs h-9">
              Close
            </Button>
            <Button onClick={() => { setIsModalOpen(false); navigate(`/edit-job/${selectedJob?.id}`); }} className="text-xs h-9 font-bold bg-blue-600 hover:bg-blue-700 text-white px-6">
              Edit Job Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}