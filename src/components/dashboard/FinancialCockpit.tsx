import React, { useState, useMemo } from "react";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { 
  TrendingUp, 
  Wallet, 
  ChevronLeft, 
  ChevronRight, 
  ArrowDownRight,
  BarChart3,
  Layers
} from "lucide-react";

interface FinancialCockpitProps {
  jobs: any[];
  payments: any[];
  expenses: any[];
  salaries: any[];
  isLoading?: boolean;
}

interface FinancialChartItem {
  label: string;
  dateKey: string;
  Revenue: number;
  Expense: number;
  Balance: number;
}

// Helper to identify initial cash / opening cash entries
const isInitialCashEntry = (desc: string = "") => {
  const lower = desc.toLowerCase().trim();
  return (
    lower.includes("initial amount") ||
    lower.includes("initial cash") ||
    lower.includes("opening cash") ||
    lower.includes("opening balance") ||
    lower.includes("initial balance")
  );
};

export const FinancialCockpit: React.FC<FinancialCockpitProps> = ({
  jobs = [],
  payments = [],
  expenses = [],
  salaries = [],
  isLoading = false
}) => {
  const currentDate = new Date();
  const currentYearStr = currentDate.getFullYear().toString();
  const currentMonthStr = `${currentYearStr}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  const [timeframe, setTimeframe] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [showTable, setShowTable] = useState<boolean>(false);

  // Month navigation handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  // Year navigation handlers
  const handlePrevYear = () => {
    setSelectedYear((prev) => (Number(prev) - 1).toString());
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => (Number(prev) + 1).toString());
  };

  // Unified financial transaction stream normalized by date
  const unifiedTransactions = useMemo(() => {
    const records: Array<{
      date: string;
      type: "Revenue" | "Expense";
      category: "Job Advance" | "Delivery Collection" | "Direct Revenue" | "Direct Expense" | "Staff Salary" | "Initial Cash";
      amount: number;
    }> = [];

    // 1. Payments from Jobs (Advances & Collections)
    payments.forEach((p: any) => {
      const job = jobs.find((j: any) => j.id === p.job_id);
      const jobDate = job?.created_at ? job.created_at.split("T")[0] : "";
      const paymentDate = p.payment_date || jobDate;

      // 1a. Advance Paid
      if (Number(p.advance_paid) > 0 && jobDate) {
        records.push({
          date: jobDate,
          type: "Revenue",
          category: "Job Advance",
          amount: Number(p.advance_paid)
        });
      }

      // 1b. Delivery Collection
      const isSplit = p.payment_method === "Split";
      const splitTotal = (Number(p.split_cash) || 0) + (Number(p.split_gpay) || 0);
      const collectionAmt = Number(p.amount_collected) > 0 
        ? Number(p.amount_collected) 
        : (isSplit && splitTotal > 0 ? splitTotal : 0);

      if (collectionAmt > 0 && paymentDate) {
        records.push({
          date: paymentDate,
          type: "Revenue",
          category: "Delivery Collection",
          amount: collectionAmt
        });
      }
    });

    // 2. Direct Revenues & Operating Expenses
    expenses.forEach((e: any) => {
      const isRev = e.type === "Revenue";
      const isSplit = e.payment_method === "Split";
      const totalAmt = isSplit 
        ? ((Number(e.split_cash) || 0) + (Number(e.split_gpay) || 0)) 
        : (Number(e.amount) || 0);

      if (totalAmt > 0 && e.date) {
        if (isRev && isInitialCashEntry(e.description)) {
          // Classified as Initial Cash - NOT operating revenue!
          records.push({
            date: e.date,
            type: "Revenue",
            category: "Initial Cash",
            amount: totalAmt
          });
        } else {
          records.push({
            date: e.date,
            type: isRev ? "Revenue" : "Expense",
            category: isRev ? "Direct Revenue" : "Direct Expense",
            amount: totalAmt
          });
        }
      }
    });

    // 3. Staff Salaries & Payroll
    salaries.forEach((s: any) => {
      const salaryAmt = Number(s.amount) || 0;
      if (salaryAmt > 0 && s.date) {
        records.push({
          date: s.date,
          type: "Expense",
          category: "Staff Salary",
          amount: salaryAmt
        });
      }
    });

    return records;
  }, [jobs, payments, expenses, salaries]);

  // Aggregate Metrics based on active timeframe (Month or Year)
  const financialData = useMemo(() => {
    let initialAmount = 0;
    let hasExplicitInit = false;

    let totalRevenue = 0;
    let jobAdvances = 0;
    let jobCollections = 0;
    let directRevenue = 0;

    let totalExpense = 0;
    let directExpense = 0;
    let staffSalaries = 0;

    const periodPrefix = timeframe === "month" ? selectedMonth : selectedYear;
    const periodStart = timeframe === "month" ? `${selectedMonth}-01` : `${selectedYear}-01-01`;

    // 1. Calculate Prior Balance Carryover from all dates strictly before periodStart
    let priorBalance = 0;
    unifiedTransactions.forEach((tx) => {
      if (tx.date < periodStart) {
        if (tx.type === "Revenue") {
          priorBalance += tx.amount;
        } else {
          priorBalance -= tx.amount;
        }
      }
    });

    // 2. Check for explicit initial cash entry logged in this period
    const periodInitTxs = unifiedTransactions.filter(
      (tx) => tx.category === "Initial Cash" && tx.date.startsWith(periodPrefix)
    );

    if (periodInitTxs.length > 0) {
      hasExplicitInit = true;
      // Sort to get the earliest date in this period that has initial cash
      const sortedInits = [...periodInitTxs].sort((a, b) => a.date.localeCompare(b.date));
      const firstDate = sortedInits[0].date;
      // Sum all initial cash entries on the earliest recorded date
      initialAmount = sortedInits
        .filter((tx) => tx.date === firstDate)
        .reduce((sum, tx) => sum + tx.amount, 0);
    } else {
      initialAmount = priorBalance;
    }

    // 3. Aggregate operating revenues and expenses for the active period
    unifiedTransactions.forEach((tx) => {
      if (tx.date.startsWith(periodPrefix)) {
        if (tx.type === "Revenue") {
          // CRITICAL REQUIREMENT: Do NOT add Initial Cash to Total Revenue!
          if (tx.category !== "Initial Cash") {
            totalRevenue += tx.amount;
            if (tx.category === "Job Advance") jobAdvances += tx.amount;
            else if (tx.category === "Delivery Collection") jobCollections += tx.amount;
            else if (tx.category === "Direct Revenue") directRevenue += tx.amount;
          }
        } else {
          totalExpense += tx.amount;
          if (tx.category === "Direct Expense") directExpense += tx.amount;
          else if (tx.category === "Staff Salary") staffSalaries += tx.amount;
        }
      }
    });

    // 4. Total Balance (Closing Cash) = Initial Amount + Total Revenue - Total Expense
    const totalBalance = initialAmount + totalRevenue - totalExpense;
    const netPeriodChange = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? ((netPeriodChange / totalRevenue) * 100).toFixed(1) : "0";

    return {
      initialAmount,
      hasExplicitInit,
      totalRevenue,
      jobAdvances,
      jobCollections,
      directRevenue,
      totalExpense,
      directExpense,
      staffSalaries,
      totalBalance,
      netPeriodChange,
      profitMargin
    };
  }, [unifiedTransactions, timeframe, selectedMonth, selectedYear]);

  // Chart & Breakdown Data Generation
  const chartData: FinancialChartItem[] = useMemo(() => {
    if (timeframe === "month") {
      // Daily breakdown for the selected month
      const [year, month] = selectedMonth.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyMap: Record<string, { Revenue: number; Expense: number }> = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, "0");
        const fullDate = `${selectedMonth}-${dayStr}`;
        dailyMap[fullDate] = { Revenue: 0, Expense: 0 };
      }

      unifiedTransactions.forEach((tx) => {
        if (tx.date.startsWith(selectedMonth) && dailyMap[tx.date]) {
          if (tx.type === "Revenue") {
            // Strictly exclude initial cash from daily revenue bars
            if (tx.category !== "Initial Cash") {
              dailyMap[tx.date].Revenue += tx.amount;
            }
          } else {
            dailyMap[tx.date].Expense += tx.amount;
          }
        }
      });

      // Compute running cash balance starting from initialAmount
      let runningBalance = financialData.initialAmount;
      return Object.entries(dailyMap).map(([fullDate, data]) => {
        const dayNum = fullDate.split("-")[2];
        runningBalance += (data.Revenue - data.Expense);
        return {
          label: `Day ${dayNum}`,
          dateKey: fullDate,
          Revenue: data.Revenue,
          Expense: data.Expense,
          Balance: runningBalance
        };
      });
    } else {
      // 12-Month breakdown for the selected year
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyMap: Record<string, { monthIndex: number; monthName: string; Revenue: number; Expense: number }> = {};

      monthNames.forEach((name, idx) => {
        const mKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
        monthlyMap[mKey] = {
          monthIndex: idx + 1,
          monthName: name,
          Revenue: 0,
          Expense: 0
        };
      });

      unifiedTransactions.forEach((tx) => {
        if (tx.date.startsWith(selectedYear)) {
          const mKey = tx.date.substring(0, 7);
          if (monthlyMap[mKey]) {
            if (tx.type === "Revenue") {
              if (tx.category !== "Initial Cash") {
                monthlyMap[mKey].Revenue += tx.amount;
              }
            } else {
              monthlyMap[mKey].Expense += tx.amount;
            }
          }
        }
      });

      let runningBalance = financialData.initialAmount;
      return Object.entries(monthlyMap).map(([mKey, data]) => {
        runningBalance += (data.Revenue - data.Expense);
        return {
          label: data.monthName,
          dateKey: mKey,
          Revenue: data.Revenue,
          Expense: data.Expense,
          Balance: runningBalance
        };
      });
    }
  }, [unifiedTransactions, timeframe, selectedMonth, selectedYear, financialData.initialAmount]);

  // High-performance Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-md p-3.5 border border-border/80 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <p className="font-bold border-b border-border/60 pb-1 text-foreground">
            {label}
          </p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="cockpit-card rounded-2xl p-6 border-border/70 animate-pulse space-y-4">
        <div className="h-6 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-muted rounded-xl" />
          <div className="h-28 bg-muted rounded-xl" />
          <div className="h-28 bg-muted rounded-xl" />
          <div className="h-28 bg-muted rounded-xl" />
        </div>
        <div className="h-64 bg-muted rounded-xl" />
      </Card>
    );
  }

  // Formatted display names
  const monthDisplayStr = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  })();

  return (
    <Card className="cockpit-card rounded-2xl border-border/80 shadow-sm overflow-hidden animate-fadeIn">
      {/* HEADER SECTION */}
      <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <CardTitle className="text-base font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Financial Performance Cockpit
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time {timeframe === "month" ? "monthly" : "annual"} revenue, operating expenses, initial cash, and closing balance.
          </p>
        </div>

        {/* CONTROLS: TIMEFRAME SELECTOR & DATE NAVIGATOR */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month / Year Switcher */}
          <div className="bg-muted/80 p-1 rounded-xl flex items-center border border-border/60">
            <button
              onClick={() => setTimeframe("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === "month"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setTimeframe("year")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === "year"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Year View
            </button>
          </div>

          {/* Date Navigator */}
          {timeframe === "month" ? (
            <div className="flex items-center gap-1 bg-card border border-border/80 rounded-xl p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <div className="px-2 text-xs font-bold font-mono text-foreground min-w-[110px] text-center">
                {monthDisplayStr}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              {selectedMonth !== currentMonthStr && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(currentMonthStr)}
                  className="h-7 px-2 text-[10px] font-bold rounded-lg ml-1"
                >
                  This Month
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-card border border-border/80 rounded-xl p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevYear}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Previous Year"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <div className="px-3 text-xs font-bold font-mono text-foreground min-w-[60px] text-center">
                {selectedYear}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextYear}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Next Year"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              {selectedYear !== currentYearStr && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedYear(currentYearStr)}
                  className="h-7 px-2 text-[10px] font-bold rounded-lg ml-1"
                >
                  This Year
                </Button>
              )}
            </div>
          )}

          {/* Toggle Breakdown Table */}
          <Button
            variant={showTable ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTable(!showTable)}
            className="h-8 text-xs font-bold rounded-xl"
          >
            {showTable ? "Hide Table" : "View Breakdown"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {/* 4 PRIMARY FINANCIAL KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. INITIAL AMOUNT */}
          <Card className="cockpit-card rounded-2xl p-4 border-border/80 bg-muted/20 hover:border-border transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Initial Amount
              </span>
              <div className="p-2 rounded-xl bg-muted text-muted-foreground">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight mt-2">
              {formatCurrency(financialData.initialAmount)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{financialData.hasExplicitInit ? "Morning drawer cash" : "Prior period carryover"}</span>
              <Badge variant="outline" className="text-[9px] font-mono">
                {financialData.hasExplicitInit ? "Logged" : "Carryover"}
              </Badge>
            </div>
          </Card>

          {/* 2. TOTAL REVENUE (OPERATING INFLOWS ONLY) */}
          <Card className="cockpit-card rounded-2xl p-4 border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Revenue ({timeframe === "month" ? "Monthly" : "Annual"})
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight mt-2">
              {formatCurrency(financialData.totalRevenue)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Coll: <strong className="font-mono text-foreground">{formatCurrency(financialData.jobCollections)}</strong></span>
              <span>•</span>
              <span>Adv: <strong className="font-mono text-foreground">{formatCurrency(financialData.jobAdvances)}</strong></span>
              {financialData.directRevenue > 0 && (
                <>
                  <span>•</span>
                  <span>Direct: <strong className="font-mono text-foreground">{formatCurrency(financialData.directRevenue)}</strong></span>
                </>
              )}
            </div>
          </Card>

          {/* 3. TOTAL EXPENSE */}
          <Card className="cockpit-card rounded-2xl p-4 border-rose-500/25 bg-rose-500/5 hover:border-rose-500/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Total Expense ({timeframe === "month" ? "Monthly" : "Annual"})
              </span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight mt-2">
              {formatCurrency(financialData.totalExpense)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-500/20 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Operating: <strong className="font-mono text-foreground">{formatCurrency(financialData.directExpense)}</strong></span>
              <span>•</span>
              <span>Payroll: <strong className="font-mono text-foreground">{formatCurrency(financialData.staffSalaries)}</strong></span>
            </div>
          </Card>

          {/* 4. TOTAL BALANCE (CLOSING BALANCE: INITIAL + REV - EXP) */}
          <Card className={`cockpit-card rounded-2xl p-4 border transition-all group ${
            financialData.totalBalance >= 0 
              ? "border-primary/30 bg-primary/5 hover:border-primary/60" 
              : "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  financialData.totalBalance >= 0 ? "text-primary" : "text-rose-600"
                }`}>
                  Total Balance
                </span>
                <Badge variant="outline" className={`text-[9px] font-mono font-bold py-0 ${
                  financialData.totalBalance >= 0 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                    : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                }`}>
                  {financialData.totalBalance >= 0 ? "SURPLUS" : "DEFICIT"}
                </Badge>
              </div>
              <div className={`p-2 rounded-xl ${
                financialData.totalBalance >= 0 ? "bg-primary/10 text-primary" : "bg-rose-500/10 text-rose-600"
              }`}>
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-2 ${
              financialData.totalBalance >= 0 ? "text-primary" : "text-rose-600"
            }`}>
              {financialData.totalBalance >= 0 ? "+" : ""}{formatCurrency(financialData.totalBalance)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Initial + Rev - Exp</span>
              <span className={`font-mono font-bold ${
                financialData.netPeriodChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
              }`}>
                Net: {financialData.netPeriodChange >= 0 ? "+" : ""}{formatCurrency(financialData.netPeriodChange)}
              </span>
            </div>
          </Card>
        </div>

        {/* VISUAL CHART SECTION */}
        <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {timeframe === "month" 
                ? `Daily Cash Flow & Cumulative Cash Balance (${monthDisplayStr})` 
                : `12-Month Financial Trajectory & Running Balance (${selectedYear})`}
            </span>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Revenue
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expense
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Closing Balance
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickMargin={8}
                />
                <YAxis 
                  tickLine={false} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="Revenue" 
                  name="Operating Revenue" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30} 
                />
                <Bar 
                  dataKey="Expense" 
                  name="Operating Expense" 
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={30} 
                />
                <Line 
                  type="monotone" 
                  dataKey="Balance" 
                  name="Closing Balance" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  dot={{ r: 3, fill: "#3b82f6" }}
                  activeDot={{ r: 5 }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* EXPANDABLE BREAKDOWN TABLE */}
        {showTable && (
          <div className="rounded-2xl border border-border/80 overflow-hidden animate-fadeIn">
            <div className="p-3.5 bg-muted/40 border-b border-border/60 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {timeframe === "month" ? `Daily Breakdown for ${monthDisplayStr}` : `12-Month Ledger for ${selectedYear}`}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {chartData.length} Periods Recorded
              </Badge>
            </div>
            <div className="overflow-x-auto max-h-[350px]">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-b border-border/80 text-xs">
                    <TableHead className="font-bold uppercase py-2.5">Period</TableHead>
                    <TableHead className="font-bold uppercase py-2.5 text-right text-emerald-600">Operating Revenue (₹)</TableHead>
                    <TableHead className="font-bold uppercase py-2.5 text-right text-rose-500">Operating Expense (₹)</TableHead>
                    <TableHead className="font-bold uppercase py-2.5 text-right">Closing Balance (₹)</TableHead>
                    <TableHead className="font-bold uppercase py-2.5 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row: any, idx: number) => {
                    const isPositive = row.Balance >= 0;
                    return (
                      <TableRow key={idx} className="border-b border-border/40 hover:bg-muted/20 text-xs font-mono">
                        <TableCell className="font-bold text-foreground font-sans">{row.label}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {row.Revenue > 0 ? formatCurrency(row.Revenue) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-500">
                          {row.Expense > 0 ? formatCurrency(row.Expense) : "-"}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${isPositive ? "text-primary" : "text-rose-600"}`}>
                          {row.Balance !== 0 ? (isPositive ? `+${formatCurrency(row.Balance)}` : formatCurrency(row.Balance)) : "-"}
                        </TableCell>
                        <TableCell className="text-center font-sans">
                          {row.Revenue === 0 && row.Expense === 0 ? (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          ) : (
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] font-bold ${
                                isPositive 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                  : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              }`}
                            >
                              {isPositive ? "Surplus" : "Deficit"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Summary Totals Row */}
                  <TableRow className="bg-muted/50 border-t-2 border-border font-bold text-xs font-mono">
                    <TableCell className="font-bold uppercase text-foreground font-sans">
                      Total ({timeframe === "month" ? "Month" : "Year"})
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(financialData.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-rose-500">
                      {formatCurrency(financialData.totalExpense)}
                    </TableCell>
                    <TableCell className={`text-right ${financialData.totalBalance >= 0 ? "text-primary" : "text-rose-600"}`}>
                      {financialData.totalBalance >= 0 ? `+${formatCurrency(financialData.totalBalance)}` : formatCurrency(financialData.totalBalance)}
                    </TableCell>
                    <TableCell className="text-center font-sans">
                      <Badge variant="default" className="text-[9px] font-bold">
                        Summary
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
