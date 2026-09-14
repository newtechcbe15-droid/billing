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
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PlusCircle, 
  Trash2,
  Calendar,
  IndianRupee,
  Users,
  Search
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
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [salarySearch, setSalarySearch] = useState("");
  const [salaryMonth, setSalaryMonth] = useState(currentMonthStr);

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
        date: todayStr, // Force today's date
        created_at: new Date().toISOString()
      };
      expList.push(newExp);
      await localDB.expenses.save(expList);
      return newExp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      toast({ title: "Log Added", description: "The log has been successfully recorded." });
      reset({ type: "Expense", description: "", amount: 0, paymentMethod: "Cash", date: todayStr });
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      let expList = await localDB.expenses.getAll();
      expList = expList.filter((e: any) => e.id !== id);
      await localDB.expenses.save(expList);
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
      toast({ title: "Salary Logged", description: "The staff salary has been successfully recorded." });
      resetSalary({ staffName: "Suresh", amount: 0, paymentMethod: "Cash", date: todayStr });
    }
  });

  const deleteSalaryMutation = useMutation({
    mutationFn: async (id: string) => {
      let salList = await localDB.salaries.getAll();
      salList = salList.filter((s: any) => s.id !== id);
      await localDB.salaries.save(salList);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allSalaries"] });
      toast({ title: "Salary Deleted" });
    }
  });

  const onAddSalary = (data: SalaryFormValues) => {
    addSalaryMutation.mutate(data);
  };

  // Build the unified ledger array
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
        timestamp: new Date(e.created_at || e.date).getTime()
      });
    });

    // 2. Add Deliveries (Payments collected on delivery) and Advances
    payments.forEach((p: any) => {
      const job = jobs.find((j: any) => j.id === p.job_id);
      const bill_no = job ? job.bill_number : "-";

      // 2a. Add Advance Payment if collected
      if (p.advance_paid && Number(p.advance_paid) > 0) {
        const advDate = job && job.created_at ? job.created_at.split("T")[0] : "-";
        
        let in_amt = Number(p.advance_paid);
        let out_amt = 0;
        
        if (p.payment_method === "GPay") {
          out_amt = in_amt;
        } else if (p.payment_method === "Split") {
          // If split, usually the advance isn't split (it's usually paid upfront via one method), 
          // but we can default to 0 out_amt for advance unless specifically known.
          out_amt = 0;
        }

        allRows.push({
          id: `adv-${p.job_id}`,
          date: advDate,
          bill_no,
          summary: `Advance Collected (${p.payment_method || "Cash"})`,
          in_amt,
          out_amt,
          is_expense: false,
          timestamp: new Date(job?.created_at || new Date().toISOString()).getTime()
        });
      }

      // 2b. Add Payment Collected on Delivery
      if (p.payment_date) {
        const in_amt = Number(p.amount_collected) || 0;
        let out_amt = 0;
        
        if (p.payment_method === "GPay") {
          out_amt = in_amt;
        } else if (p.payment_method === "Split") {
          out_amt = Number(p.split_gpay) || 0;
        }

        allRows.push({
          id: `del-${p.job_id}`,
          date: p.payment_date,
          bill_no,
          summary: `Payment Collected (${p.payment_method || "Cash"})`,
          in_amt,
          out_amt,
          is_expense: false,
          timestamp: new Date(p.payment_date).getTime()
        });
      }
    });

    // 3. Add Salaries
    salaries.forEach((s: any) => {
      allRows.push({
        id: s.id,
        date: s.date,
        bill_no: "-",
        summary: `Salary - ${s.staff_name} (${s.payment_method})`,
        in_amt: 0,
        out_amt: Number(s.amount) || 0,
        is_expense: true,
        timestamp: new Date(s.created_at || s.date).getTime()
      });
    });

    // Calculate opening balance for selectedDate
    let opBal = 0;
    if (selectedDate !== "ALL") {
      allRows.forEach(r => {
        if (r.date < selectedDate) {
          opBal += r.in_amt - r.out_amt;
        }
      });
    }

    // Filter rows for selectedDate
    let filteredRows = allRows;
    if (selectedDate !== "ALL") {
      filteredRows = allRows.filter(r => r.date === selectedDate);
      // Sort ascending by timestamp (oldest first for day book)
      filteredRows.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      // Sort descending for ALL view (newest first)
      filteredRows.sort((a, b) => b.timestamp - a.timestamp);
    }

    return { ledger: filteredRows, openingBalance: opBal };
  }, [expenses, payments, jobs, salaries, selectedDate]);

  // Calculate totals from ledger + opening balance
  const { totalIn, totalOut, balance } = useMemo(() => {
    let sumIn = openingBalance > 0 ? openingBalance : 0;
    let sumOut = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    
    ledger.forEach(r => {
      sumIn += r.in_amt;
      sumOut += r.out_amt;
    });

    return {
      totalIn: sumIn,
      totalOut: sumOut,
      balance: sumIn - sumOut
    };
  }, [ledger, openingBalance]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto min-h-screen relative z-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600">
            <IndianRupee className="w-6 h-6 text-blue-600" /> Revenue & Expenses
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track your overall business finances, revenue collected, and logged expenses.</p>
        </div>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-none border-border">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Total In (Revenue)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIn)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Includes Opening Balance</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Total Out (Expenses/GPay)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalOut)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Expenses + GPay transfers</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border bg-slate-50 dark:bg-zinc-900/50">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-500" /> Closing Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${balance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-500"}`}>
              {formatCurrency(balance)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Carried forward to tomorrow</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LOG EXPENSE & SALARY FORMS */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-border sticky top-6">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-rose-500" /> New Log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onAddExpense)} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Date (Automated)</label>
                  <Input type="date" {...register("date")} disabled className="h-9 font-medium bg-muted" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Type</label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant={watch("type") === "Expense" ? "default" : "outline"} 
                      onClick={() => setValue("type", "Expense")} 
                      className={`flex-1 h-9 text-xs font-bold ${watch("type") === "Expense" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                    >
                      Expense
                    </Button>
                    <Button 
                      type="button" 
                      variant={watch("type") === "Revenue" ? "default" : "outline"} 
                      onClick={() => setValue("type", "Revenue")} 
                      className={`flex-1 h-9 text-xs font-bold ${watch("type") === "Revenue" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    >
                      Revenue
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Description</label>
                  <Input {...register("description")} placeholder="e.g. Spare Parts, Electricity..." required className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Amount</label>
                  <Input type="number" step="0.01" {...register("amount")} required className="h-9 font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Payment Method</label>
                  <select {...register("paymentMethod")} className="w-full border rounded-lg p-2 text-xs font-medium bg-background h-9">
                    <option value="Cash">Cash</option>
                    <option value="GPay">GPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <Button type="submit" disabled={addExpenseMutation.isPending} className="w-full h-10 font-bold bg-slate-900 hover:bg-slate-800 text-white mt-2">
                  Add Log
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border sticky top-[420px]">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Log Staff Salary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmitSalary(onAddSalary)} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Date</label>
                  <Input type="date" {...registerSalary("date")} disabled className="h-9 font-medium bg-muted" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Staff Name</label>
                  <select {...registerSalary("staffName")} className="w-full border rounded-lg p-2 text-xs font-medium bg-background h-9">
                    <option value="Suresh">Suresh</option>
                    <option value="Sajith">Sajith</option>
                    <option value="Karthik Raj">Karthik Raj</option>
                    <option value="Karthi">Karthi</option>
                    <option value="Sanjay">Sanjay</option>
                    <option value="Anandhan">Anandhan</option>
                    <option value="Karthikeyan">Karthikeyan</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Amount</label>
                  <Input type="number" step="0.01" {...registerSalary("amount")} required className="h-9 font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Payment Method</label>
                  <select {...registerSalary("paymentMethod")} className="w-full border rounded-lg p-2 text-xs font-medium bg-background h-9">
                    <option value="Cash">Cash</option>
                    <option value="GPay">GPay</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <Button type="submit" disabled={addSalaryMutation.isPending} className="w-full h-10 font-bold bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Add Salary
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* EXPENSES LEDGER */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm border-border">
            <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-zinc-500" /> Day Book Ledger
              </h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant={selectedDate === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate("ALL")}
                  className="h-8 text-xs font-bold"
                >
                  View All Dates
                </Button>
                <div className="h-4 w-px bg-border mx-1"></div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Filter:</label>
                <Input 
                  type="date" 
                  value={selectedDate !== "ALL" ? selectedDate : todayStr} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="h-8 font-medium w-auto" 
                />
                <div className="relative ml-2">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input 
                    placeholder="Search ledger..." 
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="pl-8 h-8 font-medium w-32 sm:w-48 text-xs bg-background/50 border-border"
                  />
                </div>
              </div>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[60px]">S.No</TableHead>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[120px]">Bill No</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right text-emerald-600 dark:text-emerald-400 font-bold">In</TableHead>
                  <TableHead className="text-right text-rose-600 dark:text-rose-400 font-bold">Out</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDate !== "ALL" && !ledgerSearch.trim() && (
                  <TableRow className="bg-blue-50/30 dark:bg-blue-900/10">
                    <TableCell className="font-mono text-xs text-muted-foreground">-</TableCell>
                    <TableCell className="font-mono text-xs text-blue-600 font-bold">{selectedDate}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">-</TableCell>
                    <TableCell className="font-bold text-xs text-blue-600 uppercase tracking-wider">Opening Balance Brought Forward</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {openingBalance > 0 ? formatCurrency(openingBalance) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                      {openingBalance < 0 ? formatCurrency(Math.abs(openingBalance)) : "-"}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}

                {ledger.filter(row => {
                  const search = ledgerSearch.toLowerCase().trim();
                  if (!search) return true;
                  return (
                    row.bill_no.toLowerCase().includes(search) ||
                    row.summary.toLowerCase().includes(search)
                  );
                }).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-xs font-medium text-muted-foreground opacity-50">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.filter(row => {
                    const search = ledgerSearch.toLowerCase().trim();
                    if (!search) return true;
                    return (
                      row.bill_no.toLowerCase().includes(search) ||
                      row.summary.toLowerCase().includes(search)
                    );
                  }).map((row, idx) => (
                    <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{row.date}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{row.bill_no}</TableCell>
                      <TableCell className="font-medium text-xs">{row.summary}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {row.in_amt > 0 ? formatCurrency(row.in_amt) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {row.out_amt > 0 ? formatCurrency(row.out_amt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.is_expense && row.summary.startsWith("Salary") ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSalaryMutation.mutate(row.id)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : row.is_expense ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteExpenseMutation.mutate(row.id)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* STAFF SALARIES LIST */}
          <Card className="shadow-sm border-border mt-6">
            <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-zinc-500" /> Staff Salaries List
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <Button 
                  variant={salaryMonth === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSalaryMonth("ALL")}
                  className="h-8 text-xs font-bold"
                >
                  All Months
                </Button>
                <div className="h-4 w-px bg-border mx-1"></div>
                <Input 
                  type="month"
                  value={salaryMonth !== "ALL" ? salaryMonth : currentMonthStr}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="h-8 font-medium w-auto text-xs bg-background/50"
                />
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input 
                    placeholder="Search staff..." 
                    value={salarySearch}
                    onChange={(e) => setSalarySearch(e.target.value)}
                    className="pl-8 h-8 font-medium w-full sm:w-40 text-xs bg-background/50 border-border"
                  />
                </div>
              </div>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[60px]">S.No</TableHead>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Staff Name</TableHead>
                  <TableHead className="text-right">Payment Method</TableHead>
                  <TableHead className="text-right text-rose-600 dark:text-rose-400 font-bold">Amount</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.filter((row: any) => {
                  if (salaryMonth !== "ALL" && !row.date?.startsWith(salaryMonth)) return false;
                  const search = salarySearch.toLowerCase().trim();
                  if (!search) return true;
                  return (
                    row.staff_name?.toLowerCase().includes(search) ||
                    row.payment_method?.toLowerCase().includes(search)
                  );
                }).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-xs font-medium text-muted-foreground opacity-50">
                      No staff salaries logged yet for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  salaries.filter((row: any) => {
                    if (salaryMonth !== "ALL" && !row.date?.startsWith(salaryMonth)) return false;
                    const search = salarySearch.toLowerCase().trim();
                    if (!search) return true;
                    return (
                      row.staff_name?.toLowerCase().includes(search) ||
                      row.payment_method?.toLowerCase().includes(search)
                    );
                  }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((row: any, idx: number) => (
                    <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{row.date}</TableCell>
                      <TableCell className="font-medium text-xs font-bold">{row.staff_name}</TableCell>
                      <TableCell className="text-right font-medium text-xs text-muted-foreground">{row.payment_method}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(Number(row.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSalaryMutation.mutate(row.id)}
                          className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
