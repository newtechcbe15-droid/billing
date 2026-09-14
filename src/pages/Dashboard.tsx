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
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, 
  CalendarClock, 
  Search, 
  Plus, 
  Truck, 
  Package, 
  ArrowRight,
  Wrench
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Data Hydration Pipeline
  const { data: dashboardPayload, isLoading, error } = useQuery({
    queryKey: ["dashboardMetricsMaster"],
    queryFn: async () => {
      const todayISO = new Date().toISOString().split("T")[0];
      const startOfMonthISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const sevenDaysAheadISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const rawJobs = await localDB.jobs.getAll();
      const rawPayments = await localDB.payments.getAll();
      const rawWarranties = await localDB.warranties.getAll();
      const rawCustomers = await localDB.customers.getAll();

      const paymentsMap = new Map(rawPayments.map((p: any) => [p.job_id, p]));
      const warrantyMap = new Map(rawWarranties.map((w: any) => [w.job_id, w]));
      const customersMap = new Map(rawCustomers.map((c: any) => [c.id, c]));

      const fullUnifiedJobs = rawJobs.map((job: any) => ({
        ...job,
        customers: customersMap.get(job.customer_id) || null,
        payments: paymentsMap.get(job.id) || null,
        warranties: warrantyMap.get(job.id) || null
      }));

      // Sort descending by created_at
      fullUnifiedJobs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      let todayJobsCount = 0;
      let todayRevenueSum = 0;
      let monthlyRevenueSum = 0;
      let pendingBalanceSum = 0;
      let warrantiesExpiringCount = 0;

      fullUnifiedJobs.forEach((job: any) => {
        const jobDateString = job.created_at?.split("T")[0];
        const payment = job.payments;
        const warranty = job.warranties;

        if (jobDateString === todayISO) {
          todayJobsCount++;
          if (payment) {
            todayRevenueSum += ((payment.advance_paid || 0) + (payment.amount_collected || 0));
          }
        }

        if (jobDateString >= startOfMonthISO && jobDateString <= todayISO && payment) {
          monthlyRevenueSum += ((payment.advance_paid || 0) + (payment.amount_collected || 0));
        }

        if (payment) {
          pendingBalanceSum += (payment.balance_due || 0);
        }

        if (warranty && warranty.warranty_expiry_date) {
          if (warranty.warranty_expiry_date >= todayISO && warranty.warranty_expiry_date <= sevenDaysAheadISO) {
            warrantiesExpiringCount++;
          }
        }
      });

      const pendingDeliveryJobs = fullUnifiedJobs.filter((j: any) => j.status === "Ready" || j.status === "Completed");
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
          onWorking: fullUnifiedJobs.filter((j: any) => j.status === "On Working" || j.status === "Working").length,
          completed: pendingDeliveryJobs.length,
          pendingDelivery: pendingDeliveryJobs.length,
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
      <div className="p-8 max-w-xl mx-auto my-12 border border-destructive/20 bg-destructive/10 rounded-2xl text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-destructive mx-auto" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Error Ingesting Metrics</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {(error as Error).message || "An unexpected issue was encountered loading the dashboard."}
        </p>
      </div>
    );
  }

  const skeletonView = isLoading || !dashboardPayload;
  const [warrantySearch, setWarrantySearch] = useState("");

  const filteredWarranties = dashboardPayload?.expiringWarrantiesFeed.filter((job: any) => {
    const search = warrantySearch.toLowerCase().trim();
    if (!search) return true;
    return (
      job.bill_number?.toLowerCase().includes(search) ||
      job.brand?.toLowerCase().includes(search) ||
      job.model?.toLowerCase().includes(search) ||
      ((job.customers as any)?.name || "").toLowerCase().includes(search)
    );
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* SECTION 1: HEADER BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Workstation Cockpit
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational pulse, real-time ticket statuses, and revenue indicators.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={() => navigate("/jobs")}
            className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Ticket</span>
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate("/delivery")}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-xl"
          >
            <Truck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Handover</span>
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate("/stock")}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-xl"
          >
            <Package className="w-3.5 h-3.5 text-primary" />
            <span>Stock</span>
          </Button>
        </div>
      </div>

      {/* SECTION 2: METRIC CARDS */}
      <StatCards 
        metrics={dashboardPayload?.metrics || {
          totalJobs: 0, todayJobs: 0, onWorking: 0, completed: 0, pendingDelivery: 0,
          warrantyExpiringSevenDays: 0, todayRevenue: 0, monthlyRevenue: 0, pendingBalance: 0
        }} 
        isLoading={skeletonView} 
      />

      {/* SECTION 3: CHARTS ENGINE */}
      {!skeletonView && (
        <div className="w-full animate-fadeIn">
          <AnalyticsCharts rawData={dashboardPayload.jobsList as any} />
        </div>
      )}

      {/* SECTION 4: RECENT TICKETS & WARRANTIES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Jobs Stream */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              <span>Recent Jobs Pipeline</span>
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/reports")} 
              className="text-xs font-semibold text-primary h-7 gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          <div className="cockpit-card rounded-2xl overflow-hidden">
            <RecentJobsTable 
              jobs={dashboardPayload?.recentJobsFeed as any || []} 
              isLoading={skeletonView} 
              onViewDetails={(id) => navigate(`/edit-job/${id}`)}
            />
          </div>
        </div>

        {/* Right Column: Expiring Warranties Card */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-amber-500">
            <CalendarClock className="w-4 h-4" />
            <span>Warranties Expiring Soon</span>
          </h3>

          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 space-y-2">
              <CardDescription className="text-[11px] leading-tight">
                Customer guarantees concluding within 7 operational days.
              </CardDescription>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search expiring..."
                  value={warrantySearch}
                  onChange={(e) => setWarrantySearch(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl bg-background"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {skeletonView ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-10 bg-muted/60 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredWarranties.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                  No expiring guarantees in the 7-day window.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px]">
                      <TableHead className="p-3">Ticket #</TableHead>
                      <TableHead className="p-3">Asset</TableHead>
                      <TableHead className="p-3 text-right">Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarranties.map((job: any) => (
                      <TableRow key={job.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                        <TableCell className="p-3 font-mono font-bold text-foreground">
                          #{job.bill_number}
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="font-semibold text-foreground truncate max-w-[120px]">
                            {job.brand} {job.model}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {job.customers?.name || "Client"}
                          </div>
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