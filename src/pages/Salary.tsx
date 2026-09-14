import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { formatCurrency } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Wallet, 
  Smartphone, 
  Calendar, 
  Search, 
  PlusCircle, 
  Trash2, 
  BarChart3, 
  CheckCircle2
} from "lucide-react";

const TECHNICIANS = [
  "Suresh", 
  "Sajith", 
  "Karthik Raj", 
  "Karthi", 
  "Sanjay", 
  "Anandhan", 
  "Karthikeyan"
];

interface SalaryFormValues {
  staffName: string;
  customStaffName?: string;
  amount: number;
  paymentMethod: "Cash" | "GPay from MD";
  date: string;
  notes?: string;
}

export default function Salary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [staffFilter, setStaffFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"report" | "disburse" | "history">("report");

  // Fetch all salaries from Supabase
  const { data: salaries = [] } = useQuery({
    queryKey: ["allSalaries"],
    queryFn: async () => await localDB.salaries.getAll()
  });

  const { register, handleSubmit, reset, watch } = useForm<SalaryFormValues>({
    defaultValues: {
      staffName: "Suresh",
      amount: 0,
      paymentMethod: "Cash",
      date: todayStr,
      notes: ""
    }
  });

  const selectedStaffName = watch("staffName");
  const paymentMethod = watch("paymentMethod");

  // Quick month navigators
  const handlePrevMonth = () => {
    if (selectedMonth === "ALL") {
      setSelectedMonth(currentMonthStr);
      return;
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(prevDate.toISOString().substring(0, 7));
  };

  const handleNextMonth = () => {
    if (selectedMonth === "ALL") {
      setSelectedMonth(currentMonthStr);
      return;
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(nextDate.toISOString().substring(0, 7));
  };

  // Add Salary Mutation
  const addSalaryMutation = useMutation({
    mutationFn: async (values: SalaryFormValues) => {
      const finalStaffName = values.staffName === "CUSTOM" 
        ? (values.customStaffName?.trim() || "Staff Member") 
        : values.staffName;

      const salaryList = await localDB.salaries.getAll();
      const newSalary = {
        id: generateId(),
        staff_name: finalStaffName,
        amount: Number(values.amount),
        payment_method: values.paymentMethod,
        date: values.date || todayStr,
        notes: values.notes || "",
        created_at: new Date().toISOString()
      };

      try {
        await localDB.salaries.insert(newSalary);
      } catch (e) {
        console.warn("Direct insert failed, falling back to bulk save:", e);
        salaryList.push(newSalary);
        await localDB.salaries.save(salaryList);
      }

      return newSalary;
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      toast({
        title: "Salary Recorded",
        description: `Disbursed ₹${record.amount} to ${record.staff_name} via ${record.payment_method}.`
      });
      reset({
        staffName: "Suresh",
        amount: 0,
        paymentMethod: "Cash",
        date: todayStr,
        notes: ""
      });
      setActiveTab("report");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Operation Error", description: err.message });
    }
  });

  // Delete Salary Mutation
  const deleteSalaryMutation = useMutation({
    mutationFn: async (id: string) => {
      await localDB.salaries.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      toast({ title: "Salary Record Deleted", description: "Ledger and monthly reports recalculated." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Delete Failed", description: err.message });
    }
  });

  const onAddSalary = (data: SalaryFormValues) => {
    addSalaryMutation.mutate(data);
  };

  // Filtered salaries for the selected month & search
  const filteredSalaries = useMemo(() => {
    return salaries.filter((s: any) => {
      const matchMonth = selectedMonth === "ALL" || (s.date && s.date.startsWith(selectedMonth));
      const matchStaff = staffFilter === "ALL" || s.staff_name?.toLowerCase() === staffFilter.toLowerCase();
      const matchSearch = !searchTerm.trim() || 
        s.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.payment_method?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchMonth && matchStaff && matchSearch;
    }).sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
  }, [salaries, selectedMonth, staffFilter, searchTerm]);

  // Monthly aggregated metrics
  const monthlyMetrics = useMemo(() => {
    const periodSalaries = salaries.filter((s: any) => 
      selectedMonth === "ALL" || (s.date && s.date.startsWith(selectedMonth))
    );

    let totalPayroll = 0;
    let cashDrawerTotal = 0;
    let gpayMDTotal = 0;
    const staffMap: Record<string, { total: number; cash: number; gpayMD: number; count: number }> = {};

    periodSalaries.forEach((s: any) => {
      const amt = Number(s.amount) || 0;
      totalPayroll += amt;

      const pMethod = s.payment_method || "Cash";
      const isCash = pMethod === "Cash" || pMethod.toLowerCase().includes("cash") || pMethod.toLowerCase().includes("drawer");
      const isMD = pMethod.toLowerCase().includes("md") || (!isCash && pMethod.toLowerCase().includes("gpay"));

      if (isCash && !isMD) {
        cashDrawerTotal += amt;
      } else {
        gpayMDTotal += amt;
      }

      const name = s.staff_name || "Unknown";
      if (!staffMap[name]) {
        staffMap[name] = { total: 0, cash: 0, gpayMD: 0, count: 0 };
      }
      staffMap[name].total += amt;
      staffMap[name].count += 1;
      if (isCash && !isMD) {
        staffMap[name].cash += amt;
      } else {
        staffMap[name].gpayMD += amt;
      }
    });

    const staffSummaryList = Object.entries(staffMap).map(([name, stat]) => ({
      name,
      ...stat,
      percent: totalPayroll > 0 ? Math.round((stat.total / totalPayroll) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    return {
      totalPayroll,
      cashDrawerTotal,
      gpayMDTotal,
      uniqueStaffCount: Object.keys(staffMap).length,
      staffSummaryList
    };
  }, [salaries, selectedMonth]);

  const monthLabel = useMemo(() => {
    if (selectedMonth === "ALL") return "All Time Cumulative";
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Staff Salary & Payroll Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor technician monthly disbursements, audit Cash drawer deductions vs Direct MD GPay transfers.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-card border border-border/80 rounded-xl p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="h-7 px-2 text-xs font-bold rounded-lg"
              title="Previous Month"
            >
              ←
            </Button>
            <Input 
              type="month"
              value={selectedMonth === "ALL" ? currentMonthStr : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-7 w-32 border-none bg-transparent font-bold text-xs shadow-none text-center"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="h-7 px-2 text-xs font-bold rounded-lg"
              title="Next Month"
            >
              →
            </Button>
          </div>

          <Button
            variant={selectedMonth === currentMonthStr ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMonth(currentMonthStr)}
            className="h-9 text-xs font-bold rounded-xl"
          >
            This Month
          </Button>

          <Button
            variant={selectedMonth === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedMonth(selectedMonth === "ALL" ? currentMonthStr : "ALL")}
            className="h-9 text-xs font-bold rounded-xl"
          >
            {selectedMonth === "ALL" ? "Month View" : "All Time"}
          </Button>

          <Button
            onClick={() => setActiveTab("disburse")}
            className="h-9 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Disburse Salary
          </Button>
        </div>
      </div>

      {/* KPI Cards: Executive Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monthly Payroll */}
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Monthly Payroll
            </span>
            <div className="text-2xl font-black font-mono text-foreground mt-0.5">
              {formatCurrency(monthlyMetrics.totalPayroll)}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {monthLabel}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        {/* Cash from Shop Drawer (Ledger Expense) */}
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                Cash (Shop Drawer)
              </span>
              <Badge variant="outline" className="text-[8px] font-mono text-rose-600 bg-rose-500/10 border-rose-500/20 px-1 py-0">
                Ledger Expense
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrency(monthlyMetrics.cashDrawerTotal)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Deducted from Daily Cash Book ({monthlyMetrics.totalPayroll > 0 ? Math.round((monthlyMetrics.cashDrawerTotal / monthlyMetrics.totalPayroll) * 100) : 0}%)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Wallet className="w-5 h-5" />
          </div>
        </Card>

        {/* GPay from MD (Direct - Non Ledger) */}
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-purple-500">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block">
                GPay from MD
              </span>
              <Badge variant="outline" className="text-[8px] font-mono text-purple-600 bg-purple-500/10 border-purple-500/20 px-1 py-0">
                Direct MD
              </Badge>
            </div>
            <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
              {formatCurrency(monthlyMetrics.gpayMDTotal)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Direct transfer • Zero drawer impact ({monthlyMetrics.totalPayroll > 0 ? Math.round((monthlyMetrics.gpayMDTotal / monthlyMetrics.totalPayroll) * 100) : 0}%)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Smartphone className="w-5 h-5" />
          </div>
        </Card>

        {/* Active Staff Paid */}
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Disbursed Staff Count
            </span>
            <div className="text-2xl font-black font-mono text-foreground mt-0.5">
              {monthlyMetrics.uniqueStaffCount} <span className="text-sm font-normal text-muted-foreground">Technicians</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {filteredSalaries.length} total salary transactions
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "report"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Monthly Report & Breakdown
        </button>

        <button
          onClick={() => setActiveTab("disburse")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "disburse"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Disburse New Salary
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Disbursement Ledger ({filteredSalaries.length})
        </button>
      </div>

      {/* TAB 1: MONTHLY REPORT & STAFF BREAKDOWN */}
      {activeTab === "report" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Staff Breakdown Table */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground">
                  Staff-Wise Salary Report — {monthLabel}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Comparative distribution of cash register disbursements versus MD direct transfers per employee.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold">
                {monthlyMetrics.staffSummaryList.length} Active Staff
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px] font-bold uppercase text-muted-foreground bg-muted/10">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Staff Member</TableHead>
                    <TableHead className="text-right">Cash (Drawer)</TableHead>
                    <TableHead className="text-right">GPay from MD</TableHead>
                    <TableHead className="text-right">Total Disbursed</TableHead>
                    <TableHead className="w-48">Share of Payroll</TableHead>
                    <TableHead className="text-center">Vouchers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyMetrics.staffSummaryList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        No salary records found for {monthLabel}. Click "Disburse Salary" to record payments.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyMetrics.staffSummaryList.map((st, idx) => (
                      <TableRow key={st.name} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">{st.name}</div>
                          <span className="text-[10px] text-muted-foreground">Technician</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {st.cash > 0 ? formatCurrency(st.cash) : "₹0"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-purple-600 dark:text-purple-400">
                          {st.gpayMD > 0 ? formatCurrency(st.gpayMD) : "₹0"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-foreground">
                          {formatCurrency(st.total)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-muted-foreground">{st.percent}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                              <div 
                                className="bg-rose-500 h-full" 
                                style={{ width: `${st.total > 0 ? (st.cash / st.total) * 100 : 0}%` }}
                                title={`Cash: ${formatCurrency(st.cash)}`}
                              />
                              <div 
                                className="bg-purple-500 h-full" 
                                style={{ width: `${st.total > 0 ? (st.gpayMD / st.total) * 100 : 0}%` }}
                                title={`GPay MD: ${formatCurrency(st.gpayMD)}`}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                            {st.count} {st.count === 1 ? "entry" : "entries"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Notice Banner on Ledger Impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cockpit-card rounded-2xl p-4 bg-rose-500/5 border-rose-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-foreground">Daily Cash Book Expense Deduction</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Salaries marked as <strong>Cash (Shop Drawer)</strong> are automatically subtracted from the 
                    daily register closing balance in the <strong>Daily Cash Ledger</strong> module.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="cockpit-card rounded-2xl p-4 bg-purple-500/5 border-purple-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-foreground">Direct MD Transfer (Non-Ledger)</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Salaries marked as <strong>GPay from MD</strong> represent direct transfers from the Managing Director's 
                    bank account. They are logged for payroll auditing here but <strong>do NOT reduce the shop register balance</strong>.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: DISBURSE SALARY FORM */}
      {activeTab === "disburse" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form */}
          <Card className="cockpit-card rounded-2xl overflow-hidden lg:col-span-1">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-primary" />
                Record Salary Payout
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit(onAddSalary)} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Staff Member</label>
                  <select 
                    {...register("staffName")} 
                    className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                  >
                    {TECHNICIANS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="CUSTOM">+ Add Custom Staff Name</option>
                  </select>
                </div>

                {selectedStaffName === "CUSTOM" && (
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">Employee Full Name</label>
                    <Input 
                      {...register("customStaffName", { required: selectedStaffName === "CUSTOM" })}
                      placeholder="e.g. Anandhan"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Disbursement Amount (₹)</label>
                  <Input 
                    type="number"
                    step="any"
                    {...register("amount", { required: true, min: 1 })} 
                    placeholder="0.00"
                    className="h-10 text-sm font-mono font-bold rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Disbursement Date</label>
                  <Input 
                    type="date"
                    {...register("date", { required: true })} 
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                {/* Payment Source Selector */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">
                    Payment Source & Ledger Impact
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "Cash" 
                        ? "bg-rose-500/10 border-rose-500/40 text-foreground" 
                        : "bg-card border-border/60 hover:bg-muted/40"
                    }`}>
                      <input 
                        type="radio" 
                        value="Cash" 
                        {...register("paymentMethod")} 
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">Cash (Shop Drawer)</span>
                          <Badge variant="outline" className="text-[8px] text-rose-600 bg-rose-500/10 border-rose-500/20 py-0">
                            Enters Daily Ledger
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Deducts from shop physical cash drawer and records as Outflow in Daily Cash Book.
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === "GPay from MD" 
                        ? "bg-purple-500/10 border-purple-500/40 text-foreground" 
                        : "bg-card border-border/60 hover:bg-muted/40"
                    }`}>
                      <input 
                        type="radio" 
                        value="GPay from MD" 
                        {...register("paymentMethod")} 
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">GPay from MD (Direct Transfer)</span>
                          <Badge variant="outline" className="text-[8px] text-purple-600 bg-purple-500/10 border-purple-500/20 py-0">
                            Non-Ledger
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Paid directly by MD from bank account. Tracked in Payroll report, but NOT in Cash Book.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Remarks / Note (Optional)</label>
                  <Input 
                    {...register("notes")} 
                    placeholder="e.g. Monthly Salary, Festival Advance, Weekly"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={addSalaryMutation.isPending}
                  className="w-full h-11 font-bold text-xs uppercase tracking-wider rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20"
                >
                  {addSalaryMutation.isPending ? "Recording Payout..." : "Confirm & Save Salary"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Records Sidebar in Form Tab */}
          <div className="lg:col-span-2">
            <Card className="cockpit-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Recent Disbursements ({salaries.slice(0, 5).length} latest)
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab("history")} 
                  className="h-7 text-xs font-bold text-primary hover:underline"
                >
                  View All History →
                </Button>
              </div>
              <div className="p-4 space-y-2">
                {salaries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No salary payouts recorded yet.</p>
                ) : (
                  salaries.slice(0, 5).map((s: any) => {
                    const isCash = s.payment_method === "Cash" || s.payment_method?.toLowerCase().includes("cash");
                    return (
                      <div key={s.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{s.staff_name}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] font-mono font-bold ${
                                isCash 
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                  : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                              }`}
                            >
                              {s.payment_method || "Cash"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {s.date} {s.notes && `• ${s.notes}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(Number(s.amount))}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete salary record for ${s.staff_name}?`)) {
                                deleteSalaryMutation.mutate(s.id);
                              }
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE DISBURSEMENT HISTORY LEDGER */}
      {activeTab === "history" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Filter Bar */}
          <Card className="cockpit-card rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search staff, notes, mode..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl bg-background"
                  />
                </div>

                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="border border-input rounded-xl px-3 bg-background text-xs font-bold h-9 outline-none"
                >
                  <option value="ALL">All Technicians</option>
                  {TECHNICIANS.map((tech) => (
                    <option key={tech} value={tech}>{tech}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-muted-foreground font-mono">
                Showing {filteredSalaries.length} of {salaries.length} records
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px] font-bold uppercase text-muted-foreground bg-muted/20">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Payment Mode & Ledger Impact</TableHead>
                  <TableHead>Notes / Purpose</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-16 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                      No disbursement entries match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSalaries.map((s: any, idx) => {
                    const isCash = s.payment_method === "Cash" || s.payment_method?.toLowerCase().includes("cash");
                    return (
                      <TableRow key={s.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono font-medium">{s.date}</TableCell>
                        <TableCell className="font-bold text-foreground">{s.staff_name}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] font-mono font-bold uppercase ${
                              isCash 
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                            }`}
                          >
                            {isCash ? "Cash (Shop Drawer)" : "GPay from MD (Direct)"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-normal">
                          {s.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatCurrency(Number(s.amount))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete salary record of ₹${s.amount} for ${s.staff_name}?`)) {
                                deleteSalaryMutation.mutate(s.id);
                              }
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
