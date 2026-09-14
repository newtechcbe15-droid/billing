import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { localDB } from "@/lib/localDB";
import { StatCards } from "@/components/dashboard/StatCards";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";
import { RecentJobsTable } from "@/components/dashboard/RecentJobsTable";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, CalendarClock, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Master Paralellized Execution Thread Data Hydration Pipeline
  const { data: dashboardPayload, isLoading, error } = useQuery({
    queryKey: ["dashboardMetricsMaster"],
    queryFn: async () => {
      // Establish target runtime time horizons relative to current operational date (June 2026)
      const todayISO = new Date().toISOString().split("T")[0];
      const startOfMonthISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const sevenDaysAheadISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const rawJobs = await localDB.jobs.getAll();
      const rawPayments = await localDB.payments.getAll();
      const rawWarranties = await localDB.warranties.getAll();

      // Create indexed runtime mapping dictionaries to perform constant time O(1) row bindings
      const paymentsMap = new Map(rawPayments.map((p: any) => [p.job_id, p]));
      const warrantyMap = new Map(rawWarranties.map((w: any) => [w.job_id, w]));

      // Stitch structural domain rows down to single cohesive JSON collection payload matrix
      const fullUnifiedJobs = rawJobs.map((job: any) => ({
        ...job,
        payments: paymentsMap.get(job.id) || null,
        warranties: warrantyMap.get(job.id) || null
      }));

      // Initialize aggregation counters
      let todayJobsCount = 0;
      let todayRevenueSum = 0;
      let monthlyRevenueSum = 0;
      let pendingBalanceSum = 0;
      let warrantiesExpiringCount = 0;

      fullUnifiedJobs.forEach((job: any) => {
        const jobDateString = job.created_at.split("T")[0];
        const payment = job.payments;
        const warranty = job.warranties;

        // Verify day-level operational boundary metrics
        if (jobDateString === todayISO) {
          todayJobsCount++;
          if (payment) {
            todayRevenueSum += (payment.advance_paid + payment.amount_collected);
          }
        }

        // Verify month-level accounting velocity metrics
        if (jobDateString >= startOfMonthISO && jobDateString <= todayISO && payment) {
          monthlyRevenueSum += (payment.advance_paid + payment.amount_collected);
        }

        // Aggregate universal global balance configurations
        if (payment) {
          pendingBalanceSum += payment.balance_due || 0;
        }

        // Evaluate urgent risk vectors on upcoming warranty exposures (Expiring within 7 Days)
        if (warranty && warranty.warranty_expiry_date) {
          if (warranty.warranty_expiry_date >= todayISO && warranty.warranty_expiry_date <= sevenDaysAheadISO) {
            warrantiesExpiringCount++;
          }
        }
      });

      // Isolate reactive rows for active tracking views
      const pendingDeliveryJobs = fullUnifiedJobs.filter((j: any) => j.status === "Completed");
      const recentJobsFeed = fullUnifiedJobs.slice(0, 7);
      const expiringWarrantiesFeed = fullUnifiedJobs
        .filter((j: any) => j.warranties?.warranty_expiry_date && j.warranties.warranty_expiry_date >= todayISO && j.warranties.warranty_expiry_date <= sevenDaysAheadISO)
        .slice(0, 5);

      return {
        jobsList: fullUnifiedJobs,
        recentJobsFeed,
        expiringWarrantiesFeed,
        metrics: {
          totalJobs: fullUnifiedJobs.length,
          todayJobs: todayJobsCount,
          onWorking: fullUnifiedJobs.filter((j: any) => j.status === "On Working").length,
          completed: pendingDeliveryJobs.length,
          pendingDelivery: fullUnifiedJobs.filter((j: any) => j.status === "Completed").length,
          warrantyExpiringSevenDays: warrantiesExpiringCount,
          todayRevenue: todayRevenueSum,
          monthlyRevenue: monthlyRevenueSum,
          pendingBalance: pendingBalanceSum
        }
      };
    }
  });

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 border border-rose-200 bg-rose-50/50 rounded-xl text-center space-y-3 dark:bg-rose-950/10 dark:border-rose-900">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-sm font-bold text-rose-900 dark:text-rose-400 uppercase tracking-wide">Error Loading Data</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{(error as Error).message || "An unexpected error occurred while loading dashboard data."}</p>
      </div>
    );
  }

  // Generate blank loading shell interfaces while pipeline processes row counts
  const skeletonView = isLoading || !dashboardPayload;

  const [warrantySearch, setWarrantySearch] = useState("");
  const filteredWarranties = dashboardPayload?.expiringWarrantiesFeed.filter((job: any) => {
    const search = warrantySearch.toLowerCase().trim();
    if (!search) return true;
    return (
      job.bill_number?.toLowerCase().includes(search) ||
      job.brand?.toLowerCase().includes(search) ||
      job.model?.toLowerCase().includes(search) ||
      ((job.customers as any)?.name || (job.customers as any)?.[0]?.name || "").toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto dark:bg-zinc-950 min-h-screen text-slate-900 dark:text-zinc-50">
      
      {/* SECTION 1: SYSTEM TITLE DECK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-5 border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time overview of your service centre</p>
        </div>
        {skeletonView && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            Loading data...
          </div>
        )}
      </div>

      {/* SECTION 2: METRIC CARDS ARRAY GRID */}
      <StatCards 
        metrics={dashboardPayload?.metrics || {
          totalJobs: 0, todayJobs: 0, onWorking: 0, completed: 0, pendingDelivery: 0,
          warrantyExpiringSevenDays: 0, todayRevenue: 0, monthlyRevenue: 0, pendingBalance: 0
        }} 
        isLoading={skeletonView} 
      />

      {/* SECTION 3: VISUALIZATION CHARTS ENGINE LAYER */}
      {!skeletonView && (
        <div className="w-full animate-fadeIn">
          <AnalyticsCharts rawData={dashboardPayload.jobsList as any} />
        </div>
      )}

      {/* SECTION 4: DOWNSTREAM DUAL REAL-TIME ACTION REED DATA GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DATA BLOCK LEFT: DETAILED RECENT TICKETS INGESTION STREAM */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Jobs</h3>
          </div>
          <RecentJobsTable 
            jobs={dashboardPayload?.recentJobsFeed as any || []} 
            isLoading={skeletonView} 
            onViewDetails={(id) => navigate(`/edit-job/${id}`)}
          />
        </div>

        {/* DATA BLOCK RIGHT: CRITICAL ALERT VECTORS FOR EXPIRING CUSTOMER WARRANTIES */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <CalendarClock className="w-4 h-4 stroke-[2.2]" />
            Warranties Expiring Soon
          </h3>
          <Card className="shadow-sm border-border bg-card overflow-hidden">
            <CardHeader className="p-4 border-b space-y-3">
              <CardDescription className="text-[10px] leading-tight">
                Warranties expiring within the next 7 days.
              </CardDescription>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search warranties..."
                  value={warrantySearch}
                  onChange={(e) => setWarrantySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background/50 border-border shadow-none"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {skeletonView ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, idx) => <div key={idx} className="h-10 bg-muted/60 animate-pulse rounded" />)}
                </div>
              ) : filteredWarranties.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-medium opacity-50">
                  No warranties found.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="p-3">Ticket ID</TableHead>
                      <TableHead className="p-3">Asset</TableHead>
                      <TableHead className="p-3 text-right">Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarranties.map((job: any) => (
                      <TableRow key={job.id} className="border-b border-border/40 hover:bg-transparent text-[11px]">
                        <TableCell className="p-3 font-mono font-bold">{job.bill_number}</TableCell>
                        <TableCell className="p-3">
                          <div className="font-semibold text-foreground/80 truncate max-w-[110px]">{job.brand} {job.model}</div>
                          <div className="text-[9px] text-muted-foreground truncate max-w-[110px] font-mono">{(job.customers as any)?.name || (job.customers as any)?.[0]?.name}</div>
                        </TableCell>
                        <TableCell className="p-3 text-right">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-mono font-bold rounded-md">
                            {new Date(job.warranties?.warranty_expiry_date || "").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}