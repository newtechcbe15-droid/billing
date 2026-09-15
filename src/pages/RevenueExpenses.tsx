import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  paymentMethod: "Cash" | "GPay" | "Split" | "Bank Transfer" | "Other";
  splitCash?: number;
  splitGPay?: number;
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
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"ledger" | "expense_form">("ledger");
  const [logViewFilter, setLogViewFilter] = useState<"for_date" | "all">("for_date");

  const { register, handleSubmit, reset, watch, setValue } = useForm<ExpenseFormValues>({
    defaultValues: {
      type: "Expense",
      description: "",
      amount: 0,
      paymentMethod: "Cash",
      splitCash: 0,
      splitGPay: 0,
      date: todayStr
    }
  });

  const formDate = watch("date") || todayStr;

  const openEntryFormForDate = (dateToUse?: string) => {
    const targetDate = dateToUse || (selectedDate !== "ALL" ? selectedDate : todayStr);
    setValue("date", targetDate);
    setActiveTab("expense_form");
  };

  const addExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const expList = await localDB.expenses.getAll();
      const isSplit = values.paymentMethod === "Split";
      const splitCash = Number(values.splitCash) || 0;
      const splitGPay = Number(values.splitGPay) || 0;
      const finalAmount = isSplit ? (splitCash + splitGPay) : Number(values.amount);
      const chosenDate = values.date || todayStr;

      const newExp = {
        id: generateId(),
        type: values.type,
        description: values.description,
        amount: finalAmount,
        payment_method: values.paymentMethod,
        split_cash: isSplit ? splitCash : 0,
        split_gpay: isSplit ? splitGPay : 0,
        date: chosenDate,
        created_at: new Date().toISOString()
      };
      expList.push(newExp);
      await localDB.expenses.save(expList);
      return newExp;
    },
    onSuccess: (newExp) => {
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      toast({ 
        title: "Entry Recorded", 
        description: `${newExp.type} of ₹${newExp.amount} successfully logged for ${newExp.date}.` 
      });
      const activeDate = watch("date");
      reset({
        type: "Expense",
        description: "",
        amount: 0,
        paymentMethod: "Cash",
        splitCash: 0,
        splitGPay: 0,
        date: activeDate || (selectedDate !== "ALL" ? selectedDate : todayStr)
      });
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

  const deleteSalaryMutation = useMutation({
    mutationFn: async (id: string) => {
      await localDB.salaries.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      toast({ title: "Salary Record Deleted" });
    }
  });

  const onAddExpense = (data: ExpenseFormValues) => {
    addExpenseMutation.mutate(data);
  };

  // Build the unified ledger
  const { ledger, openingBalance } = useMemo(() => {
    const allRows: LedgerRow[] = [];

    // 1. Add Expenses / Revenues (Logs)
    expenses.forEach((e: any) => {
      const is_revenue = e.type === "Revenue";
      const totalAmt = Number(e.amount) || 0;
      let in_amt = 0;
      let out_amt = 0;

      if (is_revenue) {
        in_amt = totalAmt;
        if (e.payment_method === "GPay" || e.payment_method === "UPI") {
          out_amt = totalAmt;
        } else if (e.payment_method === "Split") {
          out_amt = Number(e.split_gpay) || 0;
        }
      } else {
        out_amt = totalAmt;
      }

      const summary = is_revenue && e.payment_method === "Split"
        ? `${e.description} (Split: ₹${Number(e.split_cash) || 0} Cash + ₹${Number(e.split_gpay) || 0} GPay)`
        : `${e.description} (${e.payment_method || "Cash"})`;

      allRows.push({
        id: e.id,
        date: e.date,
        bill_no: "-",
        summary,
        in_amt,
        out_amt,
        is_expense: !is_revenue,
        payment_method: e.payment_method || "Cash",
        split_cash: Number(e.split_cash) || 0,
        split_gpay: Number(e.split_gpay) || 0,
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
        
        if (p.payment_method === "GPay" || p.payment_method === "UPI") {
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
      const isSplitDelivery = p.payment_method === "Split";
      const totalSplit = (Number(p.split_cash) || 0) + (Number(p.split_gpay) || 0);
      const deliveryAmt = Number(p.amount_collected) > 0 
        ? Number(p.amount_collected) 
        : (isSplitDelivery && totalSplit > 0 ? totalSplit : 0);

      if (deliveryAmt > 0) {
        const dDate = p.payment_date || (job?.created_at ? job.created_at.split("T")[0] : todayStr);
        const in_amt = deliveryAmt;
        let out_amt = 0;
        
        if (p.payment_method === "GPay" || p.payment_method === "UPI") {
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

    // 3. Add Salaries (ONLY Cash from Drawer is recorded as Cash Book Outflow / Expense)
    // Salaries paid via "GPay from MD" are direct MD bank transfers and MUST NOT enter the shop ledger!
    salaries.forEach((s: any) => {
      const pMethod = s.payment_method || "Cash";
      const isCash = pMethod === "Cash" || pMethod.toLowerCase().includes("cash") || pMethod.toLowerCase().includes("drawer");
      const isMDTransfer = pMethod.toLowerCase().includes("md") || (!isCash && pMethod.toLowerCase().includes("gpay"));

      // Only cash from drawer deducts from shop cash book
      if (!isCash || isMDTransfer) {
        return;
      }

      allRows.push({
        id: s.id,
        date: s.date,
        bill_no: "Payroll",
        summary: `Salary: ${s.staff_name} (Cash Drawer)`,
        in_amt: 0,
        out_amt: Number(s.amount) || 0,
        is_expense: true,
        payment_method: "Cash",
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
      filteredRows = [...allRows].sort((a, b) => {
        const dateComp = (b.date || "").localeCompare(a.date || "");
        if (dateComp !== 0) return dateComp;
        return b.timestamp - a.timestamp;
      });
    }

    return { ledger: filteredRows, openingBalance: priorBalance };
  }, [expenses, payments, jobs, salaries, selectedDate, todayStr]);

  // Financial metrics for the 4 KPI cards
  const financialSummary = useMemo(() => {
    // 1. Initial Amount
    // Detect if an entry was explicitly logged as "Initial Amount", "Initial Cash", or "Opening Cash"
    const initEntry = ledger.find(r => 
      !r.is_expense && (
        r.summary.toLowerCase().includes("initial amount") ||
        r.summary.toLowerCase().includes("initial cash") ||
        r.summary.toLowerCase().includes("opening cash")
      )
    );

    const hasInitialEntry = Boolean(initEntry);
    const initialAmount = hasInitialEntry ? initEntry!.in_amt : openingBalance;

    // 2. Total Revenue & Breakdown
    let totalRevenue = 0;
    let totalCashRev = 0;
    let totalGPay = 0;
    let totalDirectExpense = 0;

    ledger.forEach(r => {
      if (!r.is_expense && r.in_amt > 0) {
        totalRevenue += r.in_amt;
        if (r.payment_method === "Split") {
          totalCashRev += (r.split_cash ?? (r.in_amt - r.out_amt));
          totalGPay += (r.split_gpay ?? r.out_amt);
        } else if (r.payment_method === "GPay" || r.payment_method === "UPI") {
          totalGPay += r.in_amt;
        } else {
          totalCashRev += r.in_amt;
        }
      } else if (r.is_expense && r.out_amt > 0) {
        totalDirectExpense += r.out_amt;
      }
    });

    // 4. Closing Balance = Total Revenue - (Total GPay + Total Expense) (plus Initial Amount if carried over from prior day)
    const closingBalance = hasInitialEntry 
      ? (totalRevenue - (totalGPay + totalDirectExpense))
      : (openingBalance + totalRevenue - (totalGPay + totalDirectExpense));

    return {
      initialAmount,
      hasInitialEntry,
      totalRevenue,
      totalCashRev,
      totalGPay,
      totalDirectExpense,
      closingBalance
    };
  }, [ledger, openingBalance]);

  // Logs for Tab 2 side panel (Filtered for active entry date or all recent)
  const displayedExpenses = useMemo(() => {
    if (logViewFilter === "for_date") {
      return expenses
        .filter((e: any) => e.date === formDate)
        .sort((a: any, b: any) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    }
    return [...expenses]
      .sort((a: any, b: any) => {
        const dateComp = (b.date || "").localeCompare(a.date || "");
        if (dateComp !== 0) return dateComp;
        return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
      })
      .slice(0, 40);
  }, [expenses, formDate, logViewFilter]);

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Daily Cash Flow Ledger
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor daily cash registers, petty expenses, and revenue inflows.
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

      {/* 4 Summary KPI Financial Cards (Replacing 7 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Initial Amount */}
        <Card className="cockpit-card rounded-2xl p-4 space-y-2 border-border/80 hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Initial Amount
            </span>
            <div className="p-2 rounded-xl bg-muted text-muted-foreground">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground tracking-tight">
            {formatCurrency(financialSummary.initialAmount)}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {financialSummary.hasInitialEntry ? "Morning cash logged in drawer" : "Prior day carryover"}
          </p>
        </Card>

        {/* 2. Total Revenue */}
        <Card className="cockpit-card rounded-2xl p-4 space-y-2 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Total Revenue
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCurrency(financialSummary.totalRevenue)}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cash: {formatCurrency(financialSummary.totalCashRev)} • GPay: {formatCurrency(financialSummary.totalGPay)}
          </p>
        </Card>

        {/* 3. Total Expense */}
        <Card className="cockpit-card rounded-2xl p-4 space-y-2 border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
              Total Expense
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-500 tracking-tight">
            {formatCurrency(financialSummary.totalDirectExpense)}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Direct shop outflows & payroll
          </p>
        </Card>

        {/* 4. Closing Balance */}
        <Card className="cockpit-card rounded-2xl p-4 space-y-2 border-primary/30 bg-primary/5 hover:border-primary/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Closing Balance
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${financialSummary.closingBalance >= 0 ? "text-primary" : "text-rose-600"}`}>
            {formatCurrency(financialSummary.closingBalance)}
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Cash in drawer</span>
            <span className="font-mono text-[9px] opacity-75">Rev - (GPay + Exp)</span>
          </p>
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
          onClick={() => {
            setActiveTab("expense_form");
            if (selectedDate !== "ALL") {
              setValue("date", selectedDate);
            }
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "expense_form"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Record Expense / Revenue
        </button>

        <Link to="/salary" className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold rounded-xl flex items-center gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
          >
            <Users className="w-3.5 h-3.5" />
            Staff Salary & Payroll →
          </Button>
        </Link>
      </div>

      {/* TAB 1: DAILY CASH BOOK LEDGER */}
      {activeTab === "ledger" && (
        <Card className="cockpit-card rounded-2xl overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Transactions on {selectedDate} ({ledger.length} Entries)
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search ledger..." 
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-xl"
                />
              </div>
              <Button
                size="sm"
                onClick={() => openEntryFormForDate(selectedDate !== "ALL" ? selectedDate : todayStr)}
                className="h-8 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                title={`Record entry for ${selectedDate !== "ALL" ? selectedDate : "today"}`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {selectedDate === "ALL" || selectedDate === todayStr ? "Add Entry" : `Add for ${selectedDate}`}
                </span>
              </Button>
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
                {/* Transaction Date Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Transaction Date
                    </label>
                    <div className="flex items-center gap-1">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setValue("date", todayStr)}
                        className={`h-6 px-2 text-[10px] font-bold rounded-lg ${formDate === todayStr ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"}`}
                      >
                        Today
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() - 1);
                          setValue("date", d.toISOString().split("T")[0]);
                        }}
                        className={`h-6 px-2 text-[10px] font-bold rounded-lg ${
                          (() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            return formDate === d.toISOString().split("T")[0];
                          })() ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"
                        }`}
                      >
                        Yesterday
                      </Button>
                    </div>
                  </div>
                  <Input 
                    type="date" 
                    {...register("date", { required: true })} 
                    className="h-10 text-xs font-mono font-bold rounded-xl"
                  />
                  {formDate < todayStr && (
                    <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-medium flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>Recording entry for past date: <strong className="font-mono font-bold">{formDate}</strong></span>
                    </div>
                  )}
                  {formDate > todayStr && (
                    <div className="mt-1.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-medium flex items-center gap-1.5">
                      <span>ℹ️</span>
                      <span>Recording entry for future date: <strong className="font-mono font-bold">{formDate}</strong></span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Transaction Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button" 
                      variant={watch("type") === "Expense" ? "default" : "outline"} 
                      onClick={() => {
                        setValue("type", "Expense");
                        if (watch("paymentMethod") === "Split") {
                          setValue("paymentMethod", "Cash");
                        }
                      }}
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
                    placeholder="e.g. Initial Amount, Scrap sales, tea, tools"
                    className="h-10 text-xs rounded-xl"
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
                    {watch("type") === "Revenue" && (
                      <option value="Split">Split (Cash + GPay)</option>
                    )}
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {watch("paymentMethod") === "Split" ? (
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                        Split Revenue Breakdown
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono font-bold text-primary border-primary/20 bg-primary/5">
                        Total: {formatCurrency((Number(watch("splitCash")) || 0) + (Number(watch("splitGPay")) || 0))}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                          Cash Portion (₹)
                        </label>
                        <Input 
                          type="number"
                          step="any"
                          {...register("splitCash", {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const cash = Number(e.target.value) || 0;
                              const gpay = Number(watch("splitGPay")) || 0;
                              setValue("amount", cash + gpay);
                            }
                          })}
                          placeholder="0.00"
                          className="h-9 text-xs font-mono font-bold rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                          GPay Portion (₹)
                        </label>
                        <Input 
                          type="number"
                          step="any"
                          {...register("splitGPay", {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const gpay = Number(e.target.value) || 0;
                              const cash = Number(watch("splitCash")) || 0;
                              setValue("amount", cash + gpay);
                            }
                          })}
                          placeholder="0.00"
                          className="h-9 text-xs font-mono font-bold rounded-xl"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Full amount of <span className="font-mono font-bold text-foreground">{formatCurrency((Number(watch("splitCash")) || 0) + (Number(watch("splitGPay")) || 0))}</span> enters Revenue (Inflow), and <span className="font-mono font-bold text-blue-500">{formatCurrency(Number(watch("splitGPay")) || 0)}</span> is deducted in Outflow/Expense.
                    </p>
                  </div>
                ) : (
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
                )}

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
              <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {logViewFilter === "for_date"
                      ? `Logs for ${formDate} (${expenses.filter((e: any) => e.date === formDate).length})`
                      : `All Recent Logs (${expenses.length})`}
                  </span>
                  {formDate !== todayStr && logViewFilter === "for_date" && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Showing records for past date: {formDate}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
                  <Button
                    type="button"
                    size="sm"
                    variant={logViewFilter === "for_date" ? "default" : "ghost"}
                    onClick={() => setLogViewFilter("for_date")}
                    className="h-7 text-[10px] font-bold px-2.5 rounded-lg"
                  >
                    {formDate === todayStr ? "Today" : formDate}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={logViewFilter === "all" ? "default" : "ghost"}
                    onClick={() => setLogViewFilter("all")}
                    className="h-7 text-[10px] font-bold px-2.5 rounded-lg"
                  >
                    All Recent
                  </Button>
                </div>
              </div>
              <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                {displayedExpenses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {logViewFilter === "for_date" 
                      ? `No custom entries logged for ${formDate}.` 
                      : "No entries recorded yet."}
                  </p>
                ) : (
                  displayedExpenses.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{item.description}</p>
                          <Badge variant="outline" className={`text-[9px] font-mono font-bold ${item.date !== todayStr ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-muted"}`}>
                            {item.date}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.payment_method} • {item.type}</p>
                        {item.payment_method === "Split" && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] font-mono text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                              Cash: {formatCurrency(item.split_cash || 0)}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] font-mono text-blue-600 bg-blue-500/10 border-blue-500/20">
                              GPay: {formatCurrency(item.split_gpay || 0)}
                            </Badge>
                          </div>
                        )}
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
    </div>
  );
}
