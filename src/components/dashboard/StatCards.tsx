import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingUp, 
  Wallet, 
  ArrowUpRight
} from "lucide-react";

// Strict domain type contracts
interface MetricsPayload {
  totalJobs: number;
  todayJobs: number;
  onWorking: number;
  completed: number;
  pendingDelivery: number;
  warrantyExpiringSevenDays: number;
  todayRevenue: number;
  monthlyRevenue: number;
  pendingBalance: number;
}

interface StatCardsProps {
  metrics: MetricsPayload;
  isLoading: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({ metrics, isLoading }) => {
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="border border-border bg-card/50 shadow-none animate-pulse">
            <CardHeader className="pb-2 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-7 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Pure declarative configuration engine for UI card layouts
  const cardConfigs = [
    {
      title: "Active Jobs",
      value: metrics.onWorking,
      subtitle: `${metrics.completed} jobs completed`,
      icon: Wrench,
      colorClass: "text-blue-500 bg-blue-500/10 dark:bg-blue-500/20",
      borderClass: "hover:border-blue-500/30",
      trend: { text: "In Progress", isPositive: true, icon: Clock }
    },
    {
      title: "Today's New Jobs",
      value: metrics.todayJobs,
      subtitle: `Total jobs: ${metrics.totalJobs}`,
      icon: ArrowUpRight,
      colorClass: "text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20",
      borderClass: "hover:border-indigo-500/30",
      trend: { text: "+12% vs yesterday", isPositive: true, icon: TrendingUp }
    },
    {
      title: "Monthly Revenue",
      value: `₹${metrics.monthlyRevenue.toLocaleString("en-IN")}`,
      subtitle: `Today: ₹${metrics.todayRevenue.toLocaleString("en-IN")}`,
      icon: Wallet,
      colorClass: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
      borderClass: "hover:border-emerald-500/30",
      trend: { text: "On Target", isPositive: true, icon: CheckCircle }
    },
    {
      title: "Pending Balance",
      value: `₹${metrics.pendingBalance.toLocaleString("en-IN")}`,
      subtitle: `${metrics.pendingDelivery} jobs awaiting pickup`,
      icon: AlertTriangle,
      colorClass: "text-rose-500 bg-rose-500/10 dark:bg-rose-500/20",
      borderClass: "hover:border-rose-500/30",
      trend: { 
        text: metrics.warrantyExpiringSevenDays > 0 ? `${metrics.warrantyExpiringSevenDays} warranties expiring` : "No immediate expirations", 
        isPositive: metrics.warrantyExpiringSevenDays === 0, 
        icon: ShieldAlert 
      }
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {cardConfigs.map((cfg, index) => {
        const IconComponent = cfg.icon;
        const TrendIcon = cfg.trend.icon;
        
        return (
          <Card 
            key={index} 
            className={`border border-border bg-card shadow-sm transition-all duration-200 cursor-default group relative overflow-hidden ${cfg.borderClass}`}
          >
            {/* Ambient accent background glows */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 bg-current transition-transform duration-300 group-hover:scale-125" style={{ color: cfg.colorClass.split(' ')[0] }} />
            
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cfg.title}
              </CardTitle>
              <div className={`p-2 rounded-lg transition-colors ${cfg.colorClass}`}>
                <IconComponent className="h-4 w-4 stroke-[2.2]" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="text-2xl font-black tracking-tight text-foreground/90">
                {cfg.value}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`inline-flex items-center gap-0.5 font-medium ${cfg.trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  <TrendIcon className="w-3.5 h-3.5" />
                  {cfg.trend.text}
                </span>
                <span className="text-muted-foreground font-normal">•</span>
                <span className="text-muted-foreground font-normal truncate max-w-[120px] sm:max-w-none">
                  {cfg.subtitle}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};