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
  Search, 
  PlusCircle, 
  Trash2, 
  BarChart3, 
  Calendar,
  Loader2
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
  const [searchTerm, setSearchTerm] = useState("");
  const [infoView, setInfoView] = useState<"breakdown" | "history">("breakdown");

  // Fetch Salaries
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

  // Filtered salaries for the selected month
  const monthSalaries = useMemo(() => {
    return salaries.filter((s: any) => 
      selectedMonth === "ALL" || (s.date && s.date.startsWith(selectedMonth))
    );
  }, [salaries, selectedMonth]);

  // Monthly aggregated salary metrics
  const monthlyMetrics = useMemo(() => {
    let totalPayroll = 0;
    let cashDrawerTotal = 0;
    let gpayMDTotal = 0;
    const staffMap: Record<string, { total: number; cash: number; gpayMD: number; count: number }> = {};

    monthSalaries.forEach((s: any) => {
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
  }, [monthSalaries]);

  // Filtered salary history records
  const historyRecords = useMemo(() => {
    return monthSalaries.filter((s: any) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        s.staff_name?.toLowerCase().includes(q) ||
        s.payment_method?.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    }).sort((a: any, b: any) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());
  }, [monthSalaries, searchTerm]);

  const monthLabel = useMemo(() => {
    if (selectedMonth === "ALL") return "All Time";
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }, [selectedMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-4">
        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
            Staff Salary & Payroll Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Disburse staff wages and monitor monthly payroll reports.
          </p>
        </div>
      </div>

      {/* Row 1: Two-Card Layout for Salary Inputs & Disbursements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =================================================================== */}
        {/* CARD 1: ENTER INPUT (DISBURSEMENT FORM) */}
        {/* =================================================================== */}
        <Card className="cockpit-card rounded-2xl overflow-hidden lg:col-span-5 shadow-lg border-border/70">
          <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-500" />
              Disburse Staff Salary
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
                        <Badge variant="outline" className="text-[8px] font-mono text-rose-600 bg-rose-500/10 border-rose-500/20 py-0">
                          Enters Daily Ledger
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Deducts from shop cash drawer and records as Expense in Daily Cash Book.
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
                        <span className="text-xs font-bold">GPay from MD (Direct)</span>
                        <Badge variant="outline" className="text-[8px] font-mono text-purple-600 bg-purple-500/10 border-purple-500/20 py-0">
                          Non-Ledger
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Paid directly by MD from bank account. Tracked here with 0 drawer deduction.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1 text-foreground">Remarks / Note (Optional)</label>
                <Input 
                  {...register("notes")} 
                  placeholder="e.g. Monthly Salary, Advance, Bonus"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <Button 
                type="submit" 
                disabled={addSalaryMutation.isPending}
                className="w-full h-11 font-bold text-xs uppercase tracking-wider rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                {addSalaryMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Recording...
                  </span>
                ) : (
                  "Record Salary Payment"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* =================================================================== */}
        {/* CARD 2: SHOW INFO (MONTHLY SALARY REPORT & DISBURSEMENTS) */}
        {/* =================================================================== */}
        <Card className="cockpit-card rounded-2xl overflow-hidden lg:col-span-7 shadow-lg border-border/70">
          {/* Card Header with Month Navigation */}
          <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Staff Salary Monthly Report ({monthLabel})
              </CardTitle>
            </div>

            {/* Month Nav Controls */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Button
                variant="outline"
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
                className="h-7 w-32 border border-border/80 bg-background font-bold text-xs text-center rounded-lg"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="h-7 px-2 text-xs font-bold rounded-lg"
                title="Next Month"
              >
                →
              </Button>
              <Button
                variant={selectedMonth === currentMonthStr ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMonth(currentMonthStr)}
                className="h-7 px-2.5 text-[11px] font-bold rounded-lg"
              >
                Current
              </Button>
              <Button
                variant={selectedMonth === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMonth(selectedMonth === "ALL" ? currentMonthStr : "ALL")}
                className="h-7 px-2.5 text-[11px] font-bold rounded-lg"
              >
                {selectedMonth === "ALL" ? "Month" : "All"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Integrated Monthly Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Total Payroll
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-foreground">
                  {formatCurrency(monthlyMetrics.totalPayroll)}
                </div>
              </div>

              <div className="space-y-0.5 border-l border-border/60 pl-2.5">
                <div className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-rose-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    Cash (Drawer)
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                  {formatCurrency(monthlyMetrics.cashDrawerTotal)}
                </div>
              </div>

              <div className="space-y-0.5 border-l border-border/60 pl-2.5">
                <div className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-purple-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                    GPay (MD)
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400">
                  {formatCurrency(monthlyMetrics.gpayMDTotal)}
                </div>
              </div>

              <div className="space-y-0.5 border-l border-border/60 pl-2.5">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Staff Paid
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-foreground">
                  {monthlyMetrics.uniqueStaffCount} <span className="text-xs font-normal text-muted-foreground">techs</span>
                </div>
              </div>
            </div>

            {/* Switcher: Staff Breakdown vs Payment History */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={infoView === "breakdown" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setInfoView("breakdown")}
                  className="h-8 text-xs font-bold rounded-xl"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Staff Breakdown ({monthlyMetrics.staffSummaryList.length})
                </Button>
                <Button
                  variant={infoView === "history" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setInfoView("history")}
                  className="h-8 text-xs font-bold rounded-xl"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Payment History ({monthSalaries.length})
                </Button>
              </div>

              {infoView === "history" && (
                <div className="relative w-40 sm:w-56">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search name, notes..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl bg-background"
                  />
                </div>
              )}
            </div>

            {/* VIEW A: STAFF MONTHLY BREAKDOWN */}
            {infoView === "breakdown" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px] font-bold uppercase text-muted-foreground bg-muted/10">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="text-right">Cash (Drawer)</TableHead>
                      <TableHead className="text-right">GPay from MD</TableHead>
                      <TableHead className="text-right">Total Paid</TableHead>
                      <TableHead className="w-28 text-center">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyMetrics.staffSummaryList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                          No salary records logged for {monthLabel}. Enter salary details on the left.
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyMetrics.staffSummaryList.map((st, idx) => (
                        <TableRow key={st.name} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                          <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-bold text-foreground">{st.name}</span>
                            <span className="text-[10px] text-muted-foreground block">{st.count} payout{st.count > 1 ? "s" : ""}</span>
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
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground">{st.percent}%</span>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex">
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
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* VIEW B: DISBURSEMENT HISTORY LOG */}
            {infoView === "history" && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px] font-bold uppercase text-muted-foreground bg-muted/10">
                      <TableHead>Date</TableHead>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount (₹)</TableHead>
                      <TableHead className="w-12 text-center">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                          No disbursement records found for {monthLabel}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyRecords.map((s: any) => {
                        const isCash = s.payment_method === "Cash" || s.payment_method?.toLowerCase().includes("cash");
                        return (
                          <TableRow key={s.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                            <TableCell className="font-mono text-muted-foreground">{s.date}</TableCell>
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
                                {isCash ? "Cash (Drawer)" : "GPay from MD"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{s.notes || "-"}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              {formatCurrency(Number(s.amount))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (window.confirm(`Delete record of ₹${s.amount} for ${s.staff_name}?`)) {
                                    deleteSalaryMutation.mutate(s.id);
                                  }
                                }}
                                className="h-6 w-6 text-muted-foreground hover:text-rose-500 rounded-md"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
