import React, { useState, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  ArrowUpDown, 
  Filter, 
  Smartphone, 
  Laptop, 
  Monitor, 
  Clock, 
  AlertCircle 
} from "lucide-react";

// Strict structural interfaces for domain contract verification
interface JobRow {
  id: string;
  bill_number: string;
  created_at: string;
  device_type: "Mobile" | "Laptop" | "PC";
  brand: string;
  model: string;
  technician_assigned: string;
  status: "Received" | "Diagnosing" | "Waiting for Parts" | "On Working" | "Testing" | "Completed" | "Delivered" | "Returned";
  customers: {
    name: string;
    mobile_number: string;
  };
  payments: {
    payment_status: "Paid" | "Partially Paid" | "Unpaid";
    balance_due: number;
  } | null;
}

interface RecentJobsTableProps {
  jobs: JobRow[];
  isLoading: boolean;
  onViewDetails?: (id: string) => void;
}

// Configured layout metrics matching target themes
const STATUS_BADGES: Record<string, string> = {
  Received: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-400 border-slate-200 dark:border-slate-800",
  Diagnosing: "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200 dark:border-purple-900",
  "Waiting for Parts": "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200 dark:border-rose-900",
  "On Working": "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-900",
  Testing: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  Completed: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900",
  Delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  Returned: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-900",
};

const PAYMENT_BADGES: Record<string, string> = {
  Paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "Partially Paid": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Unpaid: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

export const RecentJobsTable: React.FC<RecentJobsTableProps> = ({ 
  jobs = [], 
  isLoading, 
  onViewDetails 
}) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Multi-pass filtration and alignment logic sequence optimized inside useMemo
  const processedData = useMemo(() => {
    let result = [...jobs];

    // 1. Process Status Node Filters
    if (statusFilter !== "ALL") {
      result = result.filter(job => job.status === statusFilter);
    }

    // 2. Compute Match Operations for Multi-Field Intersect Search
    if (globalFilter.trim()) {
      const searchTarget = globalFilter.toLowerCase().trim();
      result = result.filter(job => 
        job.bill_number.toLowerCase().includes(searchTarget) ||
        job.customers.name.toLowerCase().includes(searchTarget) ||
        job.customers.mobile_number.includes(searchTarget) ||
        job.model.toLowerCase().includes(searchTarget) ||
        job.brand.toLowerCase().includes(searchTarget)
      );
    }

    // 3. Apply Temporal Array Sorting Options
    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [jobs, globalFilter, statusFilter, sortDirection]);

  const toggleSortOrder = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  };

  const renderDeviceIcon = (type: "Mobile" | "Laptop" | "PC") => {
    switch(type) {
      case "Mobile": return <Smartphone className="w-3.5 h-3.5 opacity-70 text-indigo-500" />;
      case "Laptop": return <Laptop className="w-3.5 h-3.5 opacity-70 text-blue-500" />;
      case "PC": return <Monitor className="w-3.5 h-3.5 opacity-70 text-purple-500" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* FILTER COCKPIT INTERACTIVE LAYER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search jobs..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 bg-background/50 border-border shadow-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground/60 hidden sm:inline" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded-md text-xs font-medium px-3 py-2 bg-background text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Jobs</option>
            <option value="Received">Received</option>
            <option value="On Working">On Working</option>
            <option value="Completed">Completed</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
          </select>
        </div>
      </div>

      {/* COMPONENT STREAM MATRIX VIEW */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-[110px] font-semibold text-xs tracking-wider">Bill ID</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider">
                <Button variant="ghost" onClick={toggleSortOrder} className="p-0 hover:bg-transparent font-semibold text-xs text-muted-foreground hover:text-foreground">
                  Logged Date
                  <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-xs tracking-wider">Customer</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider">Device</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider">Status</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider text-right">Payment</TableHead>
              {onViewDetails && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // SKELETON PLACEHOLDERS DURING STATE HYDRATION
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skele-${idx}`} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, cIdx) => (
                    <TableCell key={`cell-${cIdx}`} className="py-4">
                      <div className="h-4 bg-muted/60 animate-pulse rounded-md w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : processedData.length === 0 ? (
              // ZERO-MATCH RECOVERY VIEW INDEX
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 opacity-60">
                    <AlertCircle className="w-8 h-8 stroke-[1.5]" />
                    <p className="text-xs font-medium text-muted-foreground">No jobs matched your search criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // NORMAL STATE MATRIX RENDERING
              processedData.map((job) => (
                <TableRow key={job.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono font-bold text-xs text-foreground/90">{job.bill_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 opacity-50" />
                      {new Date(job.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-xs font-semibold text-foreground/90">{job.customers.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{job.customers.mobile_number}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                      {renderDeviceIcon(job.device_type)}
                      <span>{job.brand} <span className="opacity-60">{job.model}</span></span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-semibold py-0.5 px-2 rounded-md ${STATUS_BADGES[job.status] || ""}`}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={`text-[10px] font-mono font-bold ${PAYMENT_BADGES[job.payments?.payment_status || "Unpaid"]}`}>
                      {job.payments?.payment_status || "Unpaid"}
                    </Badge>
                    {job.payments?.balance_due && job.payments.balance_due > 0 ? (
                      <div className="text-[10px] font-mono font-medium text-rose-600 mt-0.5">Due: ₹{job.payments.balance_due.toLocaleString('en-IN')}</div>
                    ) : null}
                  </TableCell>
                  {onViewDetails && (
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => onViewDetails(job.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 h-7"
                      >
                        Manage
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};