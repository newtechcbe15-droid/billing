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
  PlusCircle, 
  Trash2, 
  Calendar, 
  Users, 
  Search, 
  ArrowDownRight, 
  ArrowUpRight, 
  Layers,
  Wallet,
  Smartphone,
  TrendingUp
} from "lucide-react";

interface ExpenseFormValues {
  type: "Expense" | "Revenue";
  description: string;
  amount: number;
  paymentMethod: "Cash" | "GPay" | "Bank Transfer" | "Other";
  date: string;
}

interface SalaryFormValues {
  staffName: string;
  amount: number;
  paymentMethod: "Cash" | "GPay" | "Bank Transfer";
  date: string;
}

interface LedgerRow {
  id: string;
  date: string;
  bill_no: string;
  summary: string;
  in_amt: number;
  out_amt: number;
  is_expense: boolean;
  timestamp: number;
  payment_method?: string;
  split_cash?: number;
  split_gpay?: number;
}

export default function RevenueExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ["allJobs"],
    queryFn: async () => await localDB.jobs.getAll()
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["allPayments"],
    queryFn: async () => await localDB.payments.getAll()
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["allExpenses"],
    queryFn: async () => await localDB.expenses.getAll()
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["allSalaries"],
    queryFn: async () => await localDB.salaries.getAll()
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [salarySearch, setSalarySearch] = useState("");
  const [salaryMonth, setSalaryMonth] = useState(currentMonthStr);
  const [activeTab, setActiveTab] = useState<"ledger" | "expense_form" | "salary_form">("ledger");

  const { register, handleSubmit, reset, watch, setValue } = useForm<ExpenseFormValues>({
    defaultValues: {
      type: "Expense",
      description: "",
      amount: 0,
      paymentMethod: "Cash",
      date: todayStr
    }
  });

  const { register: registerSalary, handleSubmit: handleSubmitSalary, reset: resetSalary } = useForm<SalaryFormValues>({
    defaultValues: {
      staffName: "Suresh",
      amount: 0,
      paymentMethod: "Cash",
      date: todayStr
    }
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const expList = await localDB.expenses.getAll();
      const newExp = {
        id: generateId(),
        type: values.type,
        description: values.description,
        amount: Number(values.amount),
        payment_method: values.paymentMethod,
        date: todayStr,
        created_at: new Date().toISOString()
      };
      expList.push(newExp);
      await localDB.expenses.save(expList);
      return newExp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      toast({ title: "Entry Recorded", description: "Expense/Revenue successfully logged." });
      reset({ type: "Expense", description: "", amount: 0, paymentMethod: "Cash", date: todayStr });
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      await localDB.expenses.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      toast({ title: "Expense Deleted" });
    }
  });

  const onAddExpense = (data: ExpenseFormValues) => {
    addExpenseMutation.mutate(data);
  };

  const addSalaryMutation = useMutation({
    mutationFn: async (values: SalaryFormValues) => {
      const salList = await localDB.salaries.getAll();
      const newSal = {
        id: generateId(),
        staff_name: values.staffName,
        amount: Number(values.amount),
        payment_method: values.paymentMethod,
        date: todayStr,
        created_at: new Date().toISOString()
      };
      salList.push(newSal);
      await localDB.salaries.save(salList);
      return newSal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      toast({ title: "Salary Logged", description: "Staff payment recorded." });
      resetSalary({ staffName: "Suresh", amount: 0, paymentMethod: "Cash", date: todayStr });
    }
  });

  const deleteSalaryMutation = useMutation({
    mutationFn: async (id: string) => {
      await localDB.salaries.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      toast({ title: "Salary Record Deleted" });
    }
  });

  const onAddSalary = (data: SalaryFormValues) => {
    addSalaryMutation.mutate(data);
  };

  // Build the unified ledger
  const { ledger, openingBalance } = useMemo(() => {
    const allRows: LedgerRow[] = [];

    // 1. Add Expenses / Revenues (Logs)
    expenses.forEach((e: any) => {
      const is_revenue = e.type === "Revenue";
      const in_amt = is_revenue ? (Number(e.amount) || 0) : 0;
      const out_amt = is_revenue ? 0 : (Number(e.amount) || 0);
      allRows.push({
        id: e.id,
        date: e.date,
        bill_no: "-",
        summary: `${e.description} (${e.payment_method})`,
        in_amt,
        out_amt,
        is_expense: !is_revenue,
        payment_method: e.payment_method,
        timestamp: new Date(e.created_at || e.date).getTime()
      });
    });

    // 2. Add Deliveries & Advances
    payments.forEach((p: any) => {
      const job = jobs.find((j: any) => j.id === p.job_id);
      const billNo = job?.bill_number || "Bill";
      const customer = job?.customers?.name || "";

      // 2a. Advance Payment
      if (Number(p.advance_paid) > 0) {
        const advDate = job?.created_at ? job.created_at.split("T")[0] : todayStr;
        const in_amt = Number(p.advance_paid);
        let out_amt = 0;
        
        if (p.payment_method === "GPay") {
          out_amt = in_amt;
        } else if (p.payment_method === "Split") {
          out_amt = Number(p.split_gpay) || 0;
        }

        const summary = p.payment_method === "Split"
          ? `Advance - ${customer || "Client"} (Split: ₹${Number(p.split_cash) || 0} Cash + ₹${Number(p.split_gpay) || 0} GPay)`
          : `Advance - ${customer || "Client"} (${p.payment_method || "Cash"})`;

        allRows.push({
          id: `${p.id}-adv`,
          date: advDate,
          bill_no: billNo,
          summary,
          in_amt,
          out_amt,
          is_expense: false,
          payment_method: p.payment_method || "Cash",
          split_cash: Number(p.split_cash) || 0,
          split_gpay: Number(p.split_gpay) || 0,
          timestamp: new Date(job?.created_at || todayStr).getTime()
        });
      }

      // 2b. Delivery Collection
      if (Number(p.amount_collected) > 0) {
        const dDate = p.payment_date || (job?.created_at ? job.created_at.split("T")[0] : todayStr);
        const in_amt = Number(p.amount_collected);
        let out_amt = 0;
        
        if (p.payment_method === "GPay") {
          out_amt = in_amt;
        } else if (p.payment_method === "Split") {
          out_amt = Number(p.split_gpay) || 0;
        }

        const summary = p.payment_method === "Split"
          ? `Delivery Coll. - ${customer || "Client"} (Split: ₹${Number(p.split_cash) || 0} Cash + ₹${Number(p.split_gpay) || 0} GPay)`
          : `Delivery Coll. - ${customer || "Client"} (${p.payment_method || "Cash"})`;

        allRows.push({
          id: `${p.id}-del`,
          date: dDate,
          bill_no: billNo,
          summary,
          in_amt,
          out_amt,
          is_expense: false,
          payment_method: p.payment_method || "Cash",
          split_cash: Number(p.split_cash) || 0,
          split_gpay: Number(p.split_gpay) || 0,
          timestamp: new Date(dDate).getTime()
        });
      }
    });

    // 3. Add Salaries
    salaries.forEach((s: any) => {
      allRows.push({
        id: s.id,
        date: s.date,
        bill_no: "Payroll",
        summary: `Salary: ${s.staff_name} (${s.payment_method})`,
        in_amt: 0,
        out_amt: Number(s.amount) || 0,
        is_expense: true,
        payment_method: s.payment_method,
        timestamp: new Date(s.created_at || s.date).getTime()
      });
    });

    // Calculate opening balance for selectedDate
    let priorBalance = 0;
    if (selectedDate !== "ALL") {
      allRows.forEach(row => {
        if (row.date < selectedDate) {
          priorBalance += (row.in_amt - row.out_amt);
        }
      });
    }

    let filteredRows = allRows;
    if (selectedDate !== "ALL") {
      filteredRows = allRows.filter(row => row.date === selectedDate);
      filteredRows.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      filteredRows = [...allRows].sort((a, b) => b.timestamp - a.timestamp);
    }

    return { ledger: filteredRows, openingBalance: priorBalance };
  }, [expenses, payments, jobs, salaries, selectedDate, todayStr]);

  // Revenue payment method split-up
  const revenueSplit = useMemo(() => {
    let cashIn = 0;
    let gpayIn = 0;
    let totalGrossRev = 0;

    ledger.forEach(r => {
      if (!r.is_expense && r.in_amt > 0) {
        totalGrossRev += r.in_amt;
        if (r.payment_method === "Split") {
          cashIn += (r.split_cash ?? (r.in_amt - r.out_amt));
          gpayIn += (r.split_gpay ?? r.out_amt);
        } else if (r.payment_method === "GPay") {
          gpayIn += r.in_amt;
        } else {
          cashIn += r.in_amt;
        }
      }
    });

    return { cashIn, gpayIn, totalGrossRev };
  }, [ledger]);

  // Daily totals
  const dailyTotals = useMemo(() => {
    let dayIn = 0;
    let dayOut = 0;
    ledger.forEach(r => {
      dayIn += r.in_amt;
      dayOut += r.out_amt;
    });
    return {
      inflow: dayIn,
      outflow: dayOut,
      closing: openingBalance + dayIn - dayOut
    };
  }, [ledger, openingBalance]);

  // Filter staff salaries by selected month and search term
  const filteredSalaries = useMemo(() => {
    return salaries.filter((s: any) => {
      if (salaryMonth !== "ALL" && !s.date?.startsWith(salaryMonth)) return false;
      if (salarySearch.trim()) {
        const term = salarySearch.toLowerCase().trim();
        return (
          s.staff_name?.toLowerCase().includes(term) ||
          s.payment_method?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [salaries, salaryMonth, salarySearch]);

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Cash Flow Ledger & Staff Payroll
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor daily cash registers, petty expenses, inflows, and staff salary disbursements.
          </p>
        </div>

        {/* Date Selector & View All Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant={selectedDate === "ALL" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setSelectedDate(selectedDate === "ALL" ? todayStr : "ALL")}
            className="h-8 text-xs font-bold rounded-xl"
          >
            {selectedDate === "ALL" ? "Showing All Dates" : "View All Dates"}
          </Button>

          <div className="flex items-center gap-2 bg-card border border-border/80 p-1 px-3 rounded-xl shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Date:</span>
            <Input 
              type="date" 
              value={selectedDate !== "ALL" ? selectedDate : todayStr} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="h-7 w-32 text-xs font-mono font-bold bg-muted/50 border-0 shadow-none px-2"
            />
          </div>
        </div>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cockpit-card rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Opening Balance
          </span>
          <div className="text-xl font-black font-mono text-foreground">
            {formatCurrency(openingBalance)}
          </div>
          <span className="text-[10px] text-muted-foreground">Prior day carryover</span>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block flex items-center justify-between">
            <span>Day Inflow</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
          </span>
          <div className="text-xl font-black font-mono text-emerald-500">
            {formatCurrency(dailyTotals.inflow)}
          </div>
          <span className="text-[10px] text-muted-foreground">Advances & collections</span>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block flex items-center justify-between">
            <span>Day Outflow</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
          </span>
          <div className="text-xl font-black font-mono text-rose-500">
            {formatCurrency(dailyTotals.outflow)}
          </div>
          <span className="text-[10px] text-muted-foreground">Expenses + GPay transfers</span>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Closing Balance
          </span>
          <div className={`text-xl font-black font-mono ${dailyTotals.closing >= 0 ? "text-primary" : "text-rose-600"}`}>
            {formatCurrency(dailyTotals.closing)}
          </div>
          <span className="text-[10px] text-muted-foreground">Actual cash in drawer</span>
        </Card>
      </div>

      {/* Revenue Payment Method Split-Up Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-emerald-500/20 bg-emerald-500/5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Cash Split Revenue
            </span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(revenueSplit.cashIn)}
            </div>
            <span className="text-[10px] text-muted-foreground">Physical cash received</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between border-blue-500/20 bg-blue-500/5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              GPay / Online Split
            </span>
            <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              {formatCurrency(revenueSplit.gpayIn)}
            </div>
            <span className="text-[10px] text-muted-foreground">Direct online bank credit</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Gross Revenue
            </span>
            <div className="text-2xl font-black font-mono text-foreground mt-0.5">
              {formatCurrency(revenueSplit.totalGrossRev)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Cash ({revenueSplit.totalGrossRev > 0 ? Math.round((revenueSplit.cashIn / revenueSplit.totalGrossRev) * 100) : 0}%) • GPay ({revenueSplit.totalGrossRev > 0 ? Math.round((revenueSplit.gpayIn / revenueSplit.totalGrossRev) * 100) : 0}%)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Navigation View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "ledger"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Daily Cash Book
        </button>

        <button
          onClick={() => setActiveTab("expense_form")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "expense_form"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Record Expense / Revenue
        </button>

        <button
          onClick={() => setActiveTab("salary_form")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "salary_form"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Staff Payroll Registry
        </button>
      </div>

      {/* TAB 1: DAILY CASH BOOK LEDGER */}
      {activeTab === "ledger" && (
        <Card className="cockpit-card rounded-2xl overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Transactions on {selectedDate} ({ledger.length} Entries)
            </span>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search ledger..." 
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/80 hover:bg-transparent">
                  <TableHead className="w-[50px] text-xs font-bold uppercase py-3.5">#</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5">Date</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5">Bill #</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5">Particulars / Details</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5 text-right">Inflow (₹)</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5 text-right">Outflow (₹)</TableHead>
                  <TableHead className="text-xs font-bold uppercase py-3.5 text-center">Type</TableHead>
                  <TableHead className="w-[50px] text-xs font-bold uppercase py-3.5 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* OPENING BALANCE ROW */}
                {selectedDate !== "ALL" && !ledgerSearch.trim() && (
                  <TableRow className="bg-primary/5 border-b border-primary/20 text-xs">
                    <TableCell className="font-mono text-muted-foreground">-</TableCell>
                    <TableCell className="font-mono text-primary font-bold">{selectedDate}</TableCell>
                    <TableCell className="font-mono font-bold text-muted-foreground">-</TableCell>
                    <TableCell className="font-bold text-primary uppercase tracking-wider">
                      Opening Balance Brought Forward
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {openingBalance > 0 ? formatCurrency(openingBalance) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-500">
                      {openingBalance < 0 ? formatCurrency(Math.abs(openingBalance)) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase bg-primary/10 text-primary border-primary/20">
                        Balance
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                  </TableRow>
                )}

                {ledger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      No financial transactions recorded on {selectedDate}.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger
                    .filter(r => !ledgerSearch || r.summary.toLowerCase().includes(ledgerSearch.toLowerCase()) || r.bill_no.toLowerCase().includes(ledgerSearch.toLowerCase()))
                    .map((row, idx) => (
                      <TableRow key={row.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{row.date}</TableCell>
                        <TableCell className="font-mono font-bold">{row.bill_no}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">{row.summary}</div>
                          {row.payment_method === "Split" && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="outline" className="text-[9px] font-mono text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                                Cash: {formatCurrency(row.split_cash || 0)}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] font-mono text-blue-600 bg-blue-500/10 border-blue-500/20">
                                GPay: {formatCurrency(row.split_gpay || 0)}
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {row.in_amt > 0 ? `+${formatCurrency(row.in_amt)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-rose-500">
                          {row.out_amt > 0 ? `-${formatCurrency(row.out_amt)}` : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] font-mono font-bold uppercase ${
                              row.is_expense 
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20" 
                                : row.payment_method === "Split"
                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                : row.payment_method === "GPay"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            }`}
                          >
                            {row.is_expense ? (row.summary.startsWith("Salary") ? "Salary" : "Expense") : (row.payment_method || "Cash")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.is_expense ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this log entry?")) {
                                  if (row.summary.startsWith("Salary")) {
                                    deleteSalaryMutation.mutate(row.id);
                                  } else {
                                    deleteExpenseMutation.mutate(row.id);
                                  }
                                }
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* TAB 2: RECORD EXPENSE / REVENUE FORM */}
      {activeTab === "expense_form" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Log New Expense / Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit(onAddExpense)} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Transaction Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button" 
                      variant={watch("type") === "Expense" ? "default" : "outline"} 
                      onClick={() => setValue("type", "Expense")}
                      className={`h-9 text-xs font-bold rounded-xl ${watch("type") === "Expense" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                    >
                      Expense (Out)
                    </Button>
                    <Button 
                      type="button" 
                      variant={watch("type") === "Revenue" ? "default" : "outline"} 
                      onClick={() => setValue("type", "Revenue")}
                      className={`h-9 text-xs font-bold rounded-xl ${watch("type") === "Revenue" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    >
                      Revenue (In)
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Description / Particulars</label>
                  <Input 
                    {...register("description", { required: true })} 
                    placeholder="e.g. Shop electricity, tea, tools"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Amount (₹)</label>
                  <Input 
                    type="number"
                    step="any"
                    {...register("amount", { required: true, min: 1 })} 
                    placeholder="0.00"
                    className="h-10 text-sm font-mono font-bold rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Method</label>
                  <select 
                    {...register("paymentMethod")} 
                    className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="GPay">GPay / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={addExpenseMutation.isPending}
                  className="w-full h-11 font-bold text-xs uppercase tracking-wider rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"
                >
                  Record Entry
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Daily Logs List */}
          <div className="lg:col-span-2">
            <Card className="cockpit-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/60 bg-muted/20">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Today's Recorded Logs ({expenses.filter((e: any) => e.date === todayStr).length})
                </span>
              </div>
              <div className="p-4 space-y-2">
                {expenses.filter((e: any) => e.date === todayStr).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No custom entries logged today.</p>
                ) : (
                  expenses.filter((e: any) => e.date === todayStr).map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground">{item.payment_method} • {item.type}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold ${item.type === "Revenue" ? "text-emerald-500" : "text-rose-500"}`}>
                          {item.type === "Revenue" ? "+" : "-"}{formatCurrency(Number(item.amount))}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteExpenseMutation.mutate(item.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF PAYROLL */}
      {activeTab === "salary_form" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Payroll Entry Form */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Disburse Staff Salary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmitSalary(onAddSalary)} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Staff Member</label>
                  <select 
                    {...registerSalary("staffName")} 
                    className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                  >
                    {["Suresh", "Sajith", "Karthik Raj", "Karthi", "Sanjay", "Anandhan", "Karthikeyan"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Salary Amount (₹)</label>
                  <Input 
                    type="number"
                    step="any"
                    {...registerSalary("amount", { required: true, min: 1 })} 
                    placeholder="0.00"
                    className="h-10 text-sm font-mono font-bold rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Method</label>
                  <select 
                    {...registerSalary("paymentMethod")} 
                    className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="GPay">GPay / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  disabled={addSalaryMutation.isPending}
                  className="w-full h-11 font-bold text-xs uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                >
                  Record Salary Payment
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Salary Records Feed */}
          <div className="lg:col-span-2">
            <Card className="cockpit-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Payroll Disbursements ({filteredSalaries.length} Records)
                </span>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant={salaryMonth === "ALL" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSalaryMonth(salaryMonth === "ALL" ? currentMonthStr : "ALL")}
                    className="h-8 text-xs font-bold rounded-xl"
                  >
                    {salaryMonth === "ALL" ? "All Months" : "Filter Month"}
                  </Button>
                  <Input 
                    type="month"
                    value={salaryMonth !== "ALL" ? salaryMonth : currentMonthStr}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    className="h-8 w-32 font-medium text-xs rounded-xl"
                  />
                  <div className="relative flex-1 sm:w-40">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search staff..." 
                      value={salarySearch}
                      onChange={(e) => setSalarySearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {filteredSalaries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No payroll records match the filter.</p>
                ) : (
                  filteredSalaries.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">{s.staff_name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.date} • {s.payment_method}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-rose-500">
                          -{formatCurrency(Number(s.amount))}
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
                          title="Delete Salary Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
