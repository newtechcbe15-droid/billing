import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Smartphone, Wrench } from "lucide-react";

// Strict type interfaces for incoming domain metrics
interface RawJobPayload {
  status: "Received" | "Diagnosing" | "Waiting for Parts" | "On Working" | "Testing" | "Completed" | "Delivered" | "Returned";
  device_type: "Mobile" | "Laptop" | "PC";
  technician_assigned: string;
  created_at: string;
  payments: {
    estimated_amount: number;
    advance_paid: number;
    amount_collected: number;
    discount: number;
    tax_percentage: number;
    balance_due: number;
  } | null;
}

interface AnalyticsChartsProps {
  rawData: RawJobPayload[];
}

// Fixed color palettes mirroring modern design parameters (Light/Dark adaptive tokens)
const STATUS_COLORS: Record<string, string> = {
  Received: "#64748b",      // Slate
  Diagnosing: "#a855f7",    // Purple
  "Waiting for Parts": "#f43f5e", // Rose
  "On Working": "#3b82f6",   // Blue
  Testing: "#eab308",       // Yellow
  Completed: "#06b6d4",     // Cyan
  Delivered: "#10b981",     // Emerald
  Returned: "#ef4444",      // Red
};

const DEVICE_COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ rawData = [] }) => {
  const [revenueTimeframe, setRevenueTimeframe] = useState<"7days" | "30days">("30days");

  // Multi-dimensional derivation matrix running on useMemo memoization layers
  const analytics = useMemo(() => {
    // 1. Safe default models for empty structures
    const statusMap: Record<string, number> = {};
    const deviceMap: Record<string, number> = { Mobile: 0, Laptop: 0, PC: 0 };
    const techMap: Record<string, { assigned: string; jobs: number; performanceUnits: number }> = {};
    const operationalTimeline: Record<string, { date: string; Revenue: number; Backlog: number }> = {};

    // 2. Linear traversal computation pass
    rawData.forEach((item) => {
      // Status Aggregations
      statusMap[item.status] = (statusMap[item.status] || 0) + 1;

      // Device Matrix Mapping
      if (item.device_type in deviceMap) {
        deviceMap[item.device_type]++;
      }

      // Financial parsing strings to date mappings
      const dateKey = new Date(item.created_at).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });

      const payment = item.payments;
      const totalCollected = (payment?.advance_paid || 0) + (payment?.amount_collected || 0);

      // Timeline interpolation processing
      if (!operationalTimeline[dateKey]) {
        operationalTimeline[dateKey] = { date: dateKey, Revenue: 0, Backlog: 0 };
      }
      operationalTimeline[dateKey].Revenue += totalCollected;
      if (item.status !== "Delivered" && item.status !== "Returned") {
        operationalTimeline[dateKey].Backlog += 1;
      }

      // Technician performance parameters
      if (item.technician_assigned) {
        if (!techMap[item.technician_assigned]) {
          techMap[item.technician_assigned] = {
            assigned: item.technician_assigned,
            jobs: 0,
            performanceUnits: 0,
          };
        }
        techMap[item.technician_assigned].jobs++;
        if (item.status === "Delivered" || item.status === "Completed") {
          techMap[item.technician_assigned].performanceUnits += 10; // Normalized arbitrary weight vector
        }
      }
    });

    // 3. Transform dictionaries cleanly into structured arrays required by Recharts
    const statusData = Object.entries(statusMap).map(([key, val]) => ({ name: key, count: val }));
    const deviceData = Object.entries(deviceMap).map(([key, val]) => ({ name: key, value: val }));
    const techData = Object.values(techMap).sort((a, b) => b.jobs - a.jobs);
    const timelineData = Object.values(operationalTimeline).slice(revenueTimeframe === "7days" ? -7 : -30);

    return { statusData, deviceData, techData, timelineData };
  }, [rawData, revenueTimeframe]);

  // High-performance clean Custom Tooltip Engine
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-md p-3 border border-border rounded-lg shadow-xl text-xs font-sans">
          <p className="font-bold border-b pb-1 mb-1.5 text-muted-foreground">{label}</p>
          {payload.map((pld: any) => (
            <div key={pld.name} className="flex items-center gap-4 justify-between my-0.5">
              <span className="flex items-center gap-1.5 text-foreground/80">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
                {pld.name}:
              </span>
              <span className="font-mono font-bold text-foreground">
                {pld.name.toLowerCase().includes("revenue") ? `₹${pld.value.toLocaleString("en-IN")}` : pld.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 w-full">
      {/* SECTION 1: MASTER TIME-SERIES AND FINANCIAL COMPOSITE MONITOR */}
      <Card className="shadow-sm border-border bg-card">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Financial Velocity & Ticket Backlog Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Correlating gross dynamic cash intake with unresolved pipeline allocations
            </CardDescription>
          </div>
          <Tabs
            value={revenueTimeframe}
            onValueChange={(v) => setRevenueTimeframe(v as "7days" | "30days")}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full sm:w-64 grid-cols-2">
              <TabsTrigger value="7days" className="text-xs">7 Days Window</TabsTrigger>
              <TabsTrigger value="30days" className="text-xs">30 Days Window</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6 h-[340px]">
          {analytics.timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No historical timeline checkpoints recorded.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.timelineData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                <XAxis dataKey="date" stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} />
                <YAxis yAxisId="left" stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                <Area yAxisId="left" type="monotone" name="Gross Revenue" dataKey="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
                <Line yAxisId="right" type="monotone" name="Active Backlog Units" dataKey="Backlog" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: DOWNSTREAM SECTOR ANALYSIS (PIE, BAR & PERFORMANCE AGGREGATIONS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CHARTS A: STATUS DISPERSION ANALYSIS */}
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-500" />
              Ticket Status Volume Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] pb-4">
            {analytics.statusData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No active ticket status nodes found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.statusData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" horizontal={false} />
                  <XAxis type="number" stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="currentColor" className="text-[10px] font-medium" tickLine={false} width={85} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {analytics.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* CHARTS B: ASSET DEPLOYMENT DISTRIBUTION VECTOR */}
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-500" />
              Device Vector Composition
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] flex flex-col justify-between">
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4}>
                    {analytics.deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-[11px] font-medium opacity-80 pb-2">
              {analytics.deviceData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DEVICE_COLORS[i] }} />
                  <span>{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CHARTS C: TECHNICIAN DISPATCH METRIC MATRIX */}
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Technician Efficiency Indexes
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {analytics.techData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No benchmark allocations assigned.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.techData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
                  <XAxis dataKey="assigned" stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} />
                  <YAxis stroke="currentColor" className="text-[10px] opacity-60" tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="jobs" fill="#6366f1" name="Assigned Tasks" radius={[4, 4, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};