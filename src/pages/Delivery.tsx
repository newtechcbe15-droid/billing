import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Wallet, 
  Loader2, 
  Truck, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";

import { useStaffRoster } from "@/lib/staffRoster";
import { deductInventoryForJob, InventoryDeductionResult } from "@/lib/inventoryService";

const WARRANTY_DURATIONS = ["No Warranty", "1 Month", "3 Months", "6 Months", "1 Year"];

interface DeliveryFormValues {
  amountCollected: number;
  deliveredBy: string;
  deliveryType: "Delivered" | "Delivered Return";
  paymentMethod: "Cash" | "GPay" | "Split";
  splitCashAmount: number;
  splitGPayAmount: number;
  warrantyDuration: string;
  displayChanged: boolean;
}

export default function Delivery() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { staffList } = useStaffRoster();
  
  const [searchParams] = useSearchParams();
  const [searchBill, setSearchBill] = useState(searchParams.get("search") || "");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Fetch pending jobs queue for the empty-state feed
  const { data: allPendingJobs = [], isLoading: loadingPending } = useQuery({
    queryKey: ["pendingDeliveryFeed"],
    queryFn: async () => {
      const [jobs, customers, payments] = await Promise.all([
        localDB.jobs.getAll(),
        localDB.customers.getAll(),
        localDB.payments.getAll()
      ]);

      const pending = jobs
        .filter((j: any) => j.status !== "Delivered" && j.status !== "Delivered Return")
        .map((j: any) => ({
          ...j,
          customers: customers.find((c: any) => c.id === j.customer_id) || null,
          payments: payments.find((p: any) => p.job_id === j.id) || null,
        }));

      pending.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return pending;
    }
  });

  // Fetch specific job based on ID
  const { data: job, isLoading } = useQuery({
    queryKey: ["deliveryJob", activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const jobs = await localDB.jobs.getAll();
      const j = jobs.find((j: any) => j.id === activeJobId);
      if (!j) throw new Error("Job not found");
      const customers = await localDB.customers.getAll();
      const customer = customers.find((c: any) => c.id === j.customer_id) || null;
      const payments = await localDB.payments.getAll();
      const payment = payments.find((p: any) => p.job_id === j.id) || null;
      const warranties = await localDB.warranties.getAll();
      const warranty = warranties.find((w: any) => w.job_id === j.id) || null;
      return { ...j, customers: customer, payments: payment, warranties: warranty };
    },
    enabled: !!activeJobId
  });

  const { register, handleSubmit, watch, reset, setValue } = useForm<DeliveryFormValues>({
    defaultValues: {
      amountCollected: 0,
      deliveredBy: "Suresh",
      deliveryType: "Delivered",
      paymentMethod: "Cash",
      splitCashAmount: 0,
      splitGPayAmount: 0,
      warrantyDuration: "No Warranty",
      displayChanged: false
    }
  });

  // Re-hydrate form when job loads, pre-filling remaining balance & display flag
  React.useEffect(() => {
    if (job) {
      const estAmt = Number(job.payments?.estimated_amount) || 0;
      const advPaid = Number(job.payments?.advance_paid) || 0;
      const disc = Number(job.payments?.discount) || 0;
      const taxPct = Number(job.payments?.tax_percentage) || 0;
      const subtotal = estAmt - disc;
      const tax = subtotal * (taxPct / 100);
      const netTotal = subtotal + tax;
      const remainingBalance = Math.max(0, netTotal - advPaid);

      const existingCollected = Number(job.payments?.amount_collected) || 0;
      const existingSplitCash = Number(job.payments?.split_cash) || 0;
      const existingSplitGPay = Number(job.payments?.split_gpay) || 0;
      const hasSplitAmounts = existingSplitCash > 0 || existingSplitGPay > 0;
      
      const initialCollected = existingCollected > 0 
        ? existingCollected 
        : (hasSplitAmounts ? (existingSplitCash + existingSplitGPay) : remainingBalance);

      const complaintLower = (job.complaint || "").toLowerCase();
      const isDisplayJob = complaintLower.includes("display") || 
                           complaintLower.includes("screen") || 
                           complaintLower.includes("folder") ||
                           complaintLower.includes("combo") ||
                           complaintLower.includes("touch") ||
                           complaintLower.includes("lcd") ||
                           complaintLower.includes("oled");

      const initialDisplayChanged = (job as any)?.display_changed !== undefined
        ? Boolean((job as any)?.display_changed)
        : isDisplayJob;

      reset({
        amountCollected: initialCollected,
        deliveredBy: job.delivered_by || "Suresh",
        deliveryType: job.status === "Delivered Return" ? "Delivered Return" : "Delivered",
        paymentMethod: (job.payments?.payment_method as any) || "Cash",
        splitCashAmount: existingSplitCash,
        splitGPayAmount: existingSplitGPay,
        warrantyDuration: job.warranties?.warranty_duration || "No Warranty",
        displayChanged: initialDisplayChanged
      });
    }
  }, [job, reset]);

  const splitCash = watch("splitCashAmount");
  const splitGPay = watch("splitGPayAmount");
  const payMeth = watch("paymentMethod");

  // Keep amountCollected in sync with Split components
  React.useEffect(() => {
    if (payMeth === "Split") {
      const totalSplit = (Number(splitCash) || 0) + (Number(splitGPay) || 0);
      if (totalSplit > 0) {
        setValue("amountCollected", totalSplit);
      }
    }
  }, [splitCash, splitGPay, payMeth, setValue]);

  const handleSearch = React.useCallback(async () => {
    if (!searchBill.trim()) return;
    const jobs = await localDB.jobs.getAll();
    const found = jobs.find((j: any) => j.bill_number?.toLowerCase() === searchBill.toLowerCase().trim());
    if (found) {
      setActiveJobId(found.id);
      toast({ title: "Job Found", description: `Loaded ticket details for #${found.bill_number}` });
    } else {
      setActiveJobId(null);
      toast({ variant: "destructive", title: "Ticket Not Found", description: `Could not find job with Bill No: ${searchBill}` });
    }
  }, [searchBill, toast]);

  // Auto search on mount if URL has search param
  React.useEffect(() => {
    if (searchParams.get("search")) {
      handleSearch();
    }
  }, [searchParams, handleSearch]);

  const estAmt = job?.payments?.estimated_amount || 0;
  const advPaid = job?.payments?.advance_paid || 0;
  const amtColl = watch("amountCollected") || 0;
  const disc = job?.payments?.discount || 0;
  const taxPct = job?.payments?.tax_percentage || 0;

  const calculatedBalance = React.useMemo(() => {
    const subtotal = estAmt - disc;
    const tax = subtotal * (taxPct / 100);
    const netTotal = subtotal + tax;
    const receipts = Number(advPaid) + Number(amtColl);
    return {
      netTotal,
      balance: Math.max(0, netTotal - receipts),
      status: receipts >= netTotal ? "Paid" : receipts > 0 ? "Partially Paid" : "Unpaid"
    };
  }, [estAmt, advPaid, amtColl, disc, taxPct]);

  const deliveryMutation = useMutation({
    mutationFn: async (values: DeliveryFormValues) => {
      if (!job) throw new Error("No active job");
      
      const jobs = await localDB.jobs.getAll();
      const payments = await localDB.payments.getAll();
      const warranties = await localDB.warranties.getAll();
      const today = new Date().toISOString().split("T")[0];
      
      // 1. Update Job Status & Delivery Remarks
      const jIndex = jobs.findIndex((j: any) => j.id === job.id);
      if (jIndex > -1) {
        jobs[jIndex].status = values.deliveryType;
        jobs[jIndex].delivered_by = values.deliveredBy;
        if (values.displayChanged) {
          const currentRemarks = jobs[jIndex].delivery_remarks || "";
          if (!currentRemarks.includes("Display Changed")) {
            jobs[jIndex].delivery_remarks = currentRemarks ? `${currentRemarks} | Display Changed` : "Display Changed";
          }
        }
        jobs[jIndex].display_changed = Boolean(values.displayChanged);
        jobs[jIndex].updated_at = new Date().toISOString();
        
        if (values.warrantyDuration && values.warrantyDuration !== "No Warranty") {
          const wDate = new Date();
          if (values.warrantyDuration === "1 Month") wDate.setMonth(wDate.getMonth() + 1);
          if (values.warrantyDuration === "3 Months") wDate.setMonth(wDate.getMonth() + 3);
          if (values.warrantyDuration === "6 Months") wDate.setMonth(wDate.getMonth() + 6);
          if (values.warrantyDuration === "1 Year") wDate.setFullYear(wDate.getFullYear() + 1);
          
          const wIndex = warranties.findIndex((w: any) => w.job_id === job.id);
          const newWarranty = {
            id: wIndex > -1 ? warranties[wIndex].id : generateId(),
            job_id: job.id,
            warranty_duration: values.warrantyDuration,
            warranty_expiry_date: wDate.toISOString().split("T")[0],
            warranty_status: "Active"
          };

          if (wIndex > -1) {
            warranties[wIndex] = newWarranty;
          } else {
            warranties.push(newWarranty);
          }
          await localDB.warranties.save(warranties);
        }

        await localDB.jobs.save(jobs);
      }
      
      // 2. Determine Collected Payment & Method Breakdown
      const isSplit = values.paymentMethod === "Split";
      const totalSplit = (Number(values.splitCashAmount) || 0) + (Number(values.splitGPayAmount) || 0);
      const collectedAmt = isSplit 
        ? (totalSplit > 0 ? totalSplit : Number(values.amountCollected || 0))
        : Number(values.amountCollected || 0);

      const pIndex = payments.findIndex((p: any) => p.job_id === job.id);
      const paymentPayload = {
        amount_collected: collectedAmt,
        payment_method: values.paymentMethod,
        payment_date: today,
        split_cash: isSplit ? Number(values.splitCashAmount || 0) : 0,
        split_gpay: isSplit ? Number(values.splitGPayAmount || 0) : 0,
        payment_status: "Paid",
        balance_due: 0,
        updated_at: new Date().toISOString()
      };

      if (pIndex > -1) {
        try {
          await localDB.payments.update(payments[pIndex].id, paymentPayload);
        } catch (e) {
          console.warn("Direct update failed, saving whole payments list:", e);
          payments[pIndex] = { ...payments[pIndex], ...paymentPayload };
          await localDB.payments.save(payments);
        }
      } else {
        // Create payment record if missing
        const newPayment = {
          id: generateId(),
          job_id: job.id,
          estimated_amount: calculatedBalance.netTotal,
          advance_paid: advPaid,
          discount: disc,
          tax_percentage: taxPct,
          created_at: new Date().toISOString(),
          ...paymentPayload
        };
        try {
          await localDB.payments.insert(newPayment);
        } catch (e) {
          payments.push(newPayment);
          await localDB.payments.save(payments);
        }
      }
      
      // 3. Automatic Inventory Deduction if Delivering Device
      let stockResult: InventoryDeductionResult | null = null;
      if (values.deliveryType === "Delivered" && job.status !== "Delivered") {
        try {
          stockResult = await deductInventoryForJob({
            id: job.id,
            brand: job.brand,
            model: job.model,
            complaint: job.complaint,
            spare_part_supplier: job.spare_part_supplier,
            device_type: (job as any).device_type || job.deviceType,
            displayChanged: values.displayChanged
          });
        } catch (stockErr) {
          console.error("Auto inventory deduction failed:", stockErr);
        }
      }

      return { jobId: job.id, stockResult };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["deliveryJob"] });
      queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
      queryClient.invalidateQueries({ queryKey: ["pendingDeliveryFeed"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["allJobs"] });
      queryClient.invalidateQueries({ queryKey: ["allExpenses"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });

      if (result?.stockResult?.deducted && result?.stockResult?.message) {
        toast({ 
          title: "Delivered & Inventory Updated", 
          description: result.stockResult.message 
        });
      } else {
        toast({ 
          title: "Delivery Processed", 
          description: "Job marked as delivered and collection recorded in ledger." 
        });
      }
      setActiveJobId(null);
      setSearchBill("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Operation Error", description: err.message });
    }
  });

  const onFormSubmit = (data: DeliveryFormValues) => {
    deliveryMutation.mutate(data);
  };

  const isAlreadyDelivered = job?.status === "Delivered" || job?.status === "Delivered Return";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Device Handover & Payment Collection
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Locate customer tickets, collect remaining settlements, and register warranty SLA.
          </p>
        </div>

        {/* Global Search input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search Bill # (e.g. 00001)" 
              value={searchBill} 
              onChange={(e) => setSearchBill(e.target.value)}
              className="pl-9 h-10 font-mono text-xs rounded-xl bg-card"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            className="h-10 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
          >
            Find Ticket
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-mono text-muted-foreground">Retrieving service ticket...</p>
        </div>
      )}

      {/* Case 1: Job is loaded and already delivered */}
      {job && !isLoading && isAlreadyDelivered && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-4 rounded-2xl border flex items-center justify-between bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6" />
              <div>
                <h3 className="text-sm font-black uppercase">Ticket Already Handed Over</h3>
                <p className="text-xs text-muted-foreground">
                  Ticket <span className="font-mono font-bold text-foreground">#{job.bill_number}</span> has status:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">{job.status}</strong>
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { setActiveJobId(null); setSearchBill(""); }}
              className="text-xs rounded-xl"
            >
              Search Another
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="cockpit-card rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client & Asset Info</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Client:</span> <span className="font-bold">{job.customers?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{job.customers?.mobile_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Device:</span> <span className="font-semibold">{job.brand} {job.model}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Defect:</span> <span>{job.complaint}</span></div>
              </div>
            </Card>

            <Card className="cockpit-card rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financial Ledger</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated:</span> <span className="font-mono">₹{job.payments?.estimated_amount || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Advance:</span> <span className="font-mono text-emerald-500">₹{job.payments?.advance_paid || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collected on Delivery:</span> <span className="font-mono text-emerald-500">₹{job.payments?.amount_collected || 0}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Method:</span> <span>{job.payments?.payment_method}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Case 2: Active Job Ready to be Delivered */}
      {job && !isLoading && !isAlreadyDelivered && (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 animate-fadeIn">
          {/* Main Inspection Voucher Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 columns: Ticket & Customer Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="cockpit-card rounded-2xl overflow-hidden">
                <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Ticket #{job.bill_number} • {job.brand} {job.model}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                    {job.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Customer</span>
                      <p className="text-xs font-bold text-foreground">{job.customers?.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{job.customers?.mobile_number}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Service Details</span>
                      <p className="text-xs font-semibold text-foreground truncate">{job.complaint}</p>
                      <p className="text-[10px] text-muted-foreground">Technician: {job.technician_assigned || "Suresh"}</p>
                    </div>
                  </div>

                  {/* Delivery Mode & Operator */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-xs font-semibold block mb-1.5 text-foreground">Handover Status</label>
                      <select 
                        {...register("deliveryType")} 
                        className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                      >
                        <option value="Delivered">Delivered (Repaired / Solved)</option>
                        <option value="Delivered Return">Delivered Return (Unsolved / Returned)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1.5 text-foreground">Delivered By</label>
                      <select 
                        {...register("deliveredBy")} 
                        className="w-full border border-input rounded-xl px-3 bg-background text-xs font-semibold h-10 outline-none"
                      >
                        {[...staffList, "Unassigned"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Display Replacement Auto-Inventory Toggle */}
                  <div className={`p-3.5 rounded-xl border transition-all ${
                    watch("displayChanged") 
                      ? "bg-primary/5 border-primary/40 shadow-xs" 
                      : "bg-muted/20 border-border/60"
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          watch("displayChanged") ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">Display Changed</span>
                            {watch("displayChanged") ? (
                              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                Will Deduct 1 Display
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 text-muted-foreground">
                                No Stock Change
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {watch("displayChanged") 
                              ? `1 Display for ${job.brand} ${job.model} will be automatically deducted from inventory upon handover.` 
                              : "Turn ON if a new display was replaced for this device (e.g. for Dead / Diagnostic repairs)."}
                          </p>
                        </div>
                      </div>
                      
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          {...register("displayChanged")}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                      </label>
                    </div>
                  </div>

                  {/* Warranty Duration Selector Chips */}
                  <div>
                    <label className="text-xs font-semibold block mb-2 text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Post-Service Warranty SLA</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WARRANTY_DURATIONS.map((dur) => {
                        const isSelected = watch("warrantyDuration") === dur;
                        return (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setValue("warrantyDuration", dur)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                                : "bg-muted/50 border border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {dur}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Payment Settlement Card */}
            <div className="space-y-6">
              <Card className="cockpit-card rounded-2xl overflow-hidden">
                <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Collection Settlement
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {/* Financial Metrics Summary */}
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Total</span>
                      <span className="font-mono font-bold">₹{calculatedBalance.netTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Advance Credited</span>
                      <span className="font-mono font-semibold text-emerald-500">₹{Number(advPaid).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-border/80" />
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="font-bold text-muted-foreground">Pending Balance</span>
                      <span className={`text-xl font-black font-mono ${calculatedBalance.balance > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                        ₹{calculatedBalance.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Collector Inputs */}
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">
                      Amount Collected Now (₹)
                    </label>
                    <Input 
                      type="number"
                      step="any"
                      {...register("amountCollected", { valueAsNumber: true })}
                      className="h-10 text-sm font-mono font-bold rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">Payment Method</label>
                    <select 
                      {...register("paymentMethod")} 
                      className="w-full border border-input rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="GPay">GPay / UPI</option>
                      <option value="Split">Split (Cash + GPay)</option>
                    </select>
                  </div>

                  {payMeth === "Split" && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 animate-slideUp">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Cash Part (₹)</label>
                        <Input 
                          type="number" 
                          step="any" 
                          {...register("splitCashAmount", { valueAsNumber: true })} 
                          className="h-8 text-xs font-mono" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">GPay Part (₹)</label>
                        <Input 
                          type="number" 
                          step="any" 
                          {...register("splitGPayAmount", { valueAsNumber: true })} 
                          className="h-8 text-xs font-mono" 
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-3 space-y-2">
                    <Button 
                      type="submit" 
                      disabled={deliveryMutation.isPending}
                      className="w-full h-11 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
                    >
                      {deliveryMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                        </span>
                      ) : (
                        "Complete Delivery & Handover"
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setActiveJobId(null)} 
                      className="w-full h-9 text-xs font-semibold rounded-xl"
                    >
                      Cancel Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Case 3: Idle / No Job Selected -> Show "Pending Handover Queue" Feed */}
      {!job && !isLoading && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tickets Awaiting Delivery ({allPendingJobs.length})
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Click any card to load handover voucher</span>
          </div>

          {loadingPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-28 rounded-2xl bg-card border border-border animate-pulse p-4 space-y-2" />
              ))}
            </div>
          ) : allPendingJobs.length === 0 ? (
            <Card className="cockpit-card rounded-2xl p-12 text-center text-muted-foreground space-y-2">
              <Truck className="w-10 h-10 mx-auto opacity-40 text-primary" />
              <p className="text-sm font-bold text-foreground">All Jobs Delivered!</p>
              <p className="text-xs">There are currently no active tickets waiting for customer pickup.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPendingJobs.map((j: any) => {
                const balance = Math.max(0, (j.payments?.estimated_amount || 0) - (j.payments?.advance_paid || 0));
                return (
                  <div
                    key={j.id}
                    onClick={() => {
                      setSearchBill(j.bill_number);
                      setActiveJobId(j.id);
                    }}
                    className="cockpit-card p-4 rounded-2xl border border-border hover:border-primary/50 cursor-pointer group space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-sm text-foreground">
                          #{j.bill_number}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                          {j.status}
                        </Badge>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-500">
                        ₹{balance.toFixed(2)} due
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-foreground truncate">
                        {j.brand} {j.model}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {j.customers?.name || "Customer"} • {j.customers?.mobile_number || "-"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[160px]">{j.complaint}</span>
                      <span className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Handover <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
