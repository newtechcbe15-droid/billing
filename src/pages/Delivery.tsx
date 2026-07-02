import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Wallet, BadgeCheck, Loader2 } from "lucide-react";

const TECHNICIANS = ["Suresh", "Sajith", "Karthik Raj", "Karthi", "Sanjay", "Anandhan", "Karthikeyan", "Unassigned"];

interface DeliveryFormValues {
  amountCollected: number;
  deliveredBy: string;
  deliveryType: "Delivered" | "Delivered Return";
  paymentMethod: "Cash" | "GPay" | "Split";
  splitCashAmount: number;
  splitGPayAmount: number;
  warrantyDuration: string;
}

export default function Delivery() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchParams] = useSearchParams();
  const [searchBill, setSearchBill] = useState(searchParams.get("search") || "");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

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

  const { register, handleSubmit, watch, reset } = useForm<DeliveryFormValues>({
    defaultValues: {
      amountCollected: 0,
      deliveredBy: "Suresh",
      deliveryType: "Delivered",
      paymentMethod: "Cash",
      splitCashAmount: 0,
      splitGPayAmount: 0,
      warrantyDuration: "No Warranty"
    }
  });

  // Re-hydrate form when job loads
  React.useEffect(() => {
    if (job) {
      reset({
        amountCollected: job.payments?.amount_collected || 0,
        deliveredBy: job.delivered_by || "Suresh",
        deliveryType: job.status === "Delivered Return" ? "Delivered Return" : "Delivered"
      });
    }
  }, [job, reset]);

  const handleSearch = React.useCallback(async () => {
    const jobs = await localDB.jobs.getAll();
    const found = jobs.find((j: any) => j.bill_number.toLowerCase() === searchBill.toLowerCase());
    if (found) {
      setActiveJobId(found.id);
      toast({ title: "Job Found", description: `Loaded details for ${found.bill_number}` });
    } else {
      setActiveJobId(null);
      toast({ variant: "destructive", title: "Not Found", description: `Could not find job with Bill No: ${searchBill}` });
    }
  }, [searchBill, toast]);

  // Auto search on mount if URL has search param
  React.useEffect(() => {
    if (searchParams.get("search")) {
      handleSearch();
    }
  }, [searchParams, handleSearch]);

  const deliveryMutation = useMutation({
    mutationFn: async (values: DeliveryFormValues) => {
      if (!job) throw new Error("No active job");
      
      const jobs = await localDB.jobs.getAll();
      const payments = await localDB.payments.getAll();
      const warranties = await localDB.warranties.getAll();
      
      const jIndex = jobs.findIndex((j: any) => j.id === job.id);
      if (jIndex > -1) {
        jobs[jIndex].status = values.deliveryType; // Set status dynamically
        jobs[jIndex].delivered_by = values.deliveredBy;
        
        if (values.warrantyDuration && values.warrantyDuration !== "No Warranty") {
          const wDate = new Date();
          if (values.warrantyDuration === "1 Month") wDate.setMonth(wDate.getMonth() + 1);
          if (values.warrantyDuration === "3 Months") wDate.setMonth(wDate.getMonth() + 3);
          if (values.warrantyDuration === "6 Months") wDate.setMonth(wDate.getMonth() + 6);
          if (values.warrantyDuration === "1 Year") wDate.setFullYear(wDate.getFullYear() + 1);
          
          const wIndex = warranties.findIndex((w: any) => w.job_id === job.id);
          const newWarranty = {
            id: wIndex > -1 ? warranties[wIndex].id : crypto.randomUUID(),
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
      
      const pIndex = payments.findIndex((p: any) => p.job_id === job.id);
      if (pIndex > -1) {
        payments[pIndex].amount_collected = values.amountCollected;
        payments[pIndex].payment_method = values.paymentMethod;
        payments[pIndex].payment_date = new Date().toISOString().split("T")[0];
        if (values.paymentMethod === "Split") {
          payments[pIndex].split_cash = values.splitCashAmount;
          payments[pIndex].split_gpay = values.splitGPayAmount;
        }
        await localDB.payments.save(payments);
      }
      
      return job.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryJob"] });
      queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
      toast({ title: "Delivery Processed", description: "Job marked as delivered and payments updated." });
      setActiveJobId(null);
      setSearchBill("");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  const onFormSubmit = (data: DeliveryFormValues) => {
    deliveryMutation.mutate(data);
  };

  const estAmt = job?.payments?.estimated_amount || 0;
  const advPaid = job?.payments?.advance_paid || 0;
  const amtColl = watch("amountCollected") || 0;
  const payMeth = watch("paymentMethod") || "Cash";
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

  const isAlreadyDelivered = job?.status === "Delivered" || job?.status === "Delivered Return";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto min-h-screen pb-16 relative z-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-pink-500">Delivery & Payments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Search for a bill to complete payment collection and hand-over.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 max-w-md">
        <Input 
          placeholder="Enter Bill Number (e.g. 00001)" 
          value={searchBill} 
          onChange={(e) => setSearchBill(e.target.value)}
          className="font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} className="px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white">
          <Search className="w-4 h-4 mr-2" /> Search
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {job && !isLoading && isAlreadyDelivered && (
        <div className="space-y-6 mt-8 animate-fadeIn">
          <div className="p-4 rounded-xl border flex flex-col gap-1 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 shadow-sm">
            <h3 className="text-sm font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" /> Already Delivered
            </h3>
            <p className="text-xs font-semibold mt-1">
              Bill No: <span className="font-mono">{job.bill_number}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer: {job.customers?.name} ({job.customers?.mobile_number})
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Device: {job.brand} {job.model} - {job.complaint}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Delivery Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-bold">{job.status}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Delivered By:</span>
                  <span className="font-bold">{job.delivered_by || "Unknown"}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Warranty:</span>
                  <span className="font-bold">{job.warranties?.warranty_duration || "No Warranty"}</span>
                </div>
                {job.warranties?.warranty_expiry_date && (
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Warranty Expiry:</span>
                    <span className="font-bold text-blue-600">{new Date(job.warranties.warranty_expiry_date).toLocaleDateString("en-IN")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="font-bold">{job.payments?.payment_method || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Advance Paid:</span>
                  <span className="font-bold">₹{job.payments?.advance_paid || 0}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Amount Collected:</span>
                  <span className="font-bold text-emerald-600">₹{job.payments?.amount_collected || 0}</span>
                </div>
                {job.payments?.payment_method === "Split" && (
                  <>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Split (Cash):</span>
                      <span className="font-bold">₹{job.payments?.split_cash || 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Split (GPay):</span>
                      <span className="font-bold">₹{job.payments?.split_gpay || 0}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {job && !isLoading && !isAlreadyDelivered && (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 animate-fadeIn mt-8">
          
          <div className="p-4 rounded-xl border flex flex-col gap-1 bg-slate-50 dark:bg-zinc-900 shadow-sm">
            <h3 className="text-sm font-black uppercase">Job Summary: {job.bill_number}</h3>
            <p className="text-xs font-semibold text-muted-foreground">{job.customers?.name} | {job.customers?.mobile_number}</p>
            <p className="text-[11px] font-mono mt-2 opacity-80">{job.brand} {job.model} - {job.complaint}</p>
          </div>

          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 flex flex-row items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Billing & Payment</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1 opacity-60">Estimated Cost (Locked)</label>
                  <Input type="number" value={estAmt} disabled className="h-9 bg-muted/50 font-bold" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1 opacity-60">Advance Paid (Locked)</label>
                  <Input type="number" value={advPaid} disabled className="h-9 bg-muted/50 font-bold text-emerald-600" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1 text-blue-600">Amount Collected (New)*</label>
                  <Input type="number" {...register("amountCollected")} className="h-9 font-bold border-blue-500/30 bg-blue-50/20" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Cash Type*</label>
                  <select {...register("paymentMethod")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9 border-blue-500/30 bg-blue-50/20">
                    <option value="Cash">Cash</option>
                    <option value="GPay">GPay</option>
                    <option value="Split">Split (Cash & GPay)</option>
                  </select>
                </div>
                {payMeth === "Split" && (
                  <>
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-indigo-600">Split Cash Amount*</label>
                      <Input type="number" {...register("splitCashAmount")} className="h-9 font-bold border-indigo-500/30 bg-indigo-50/20" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-purple-600">Split GPay Amount*</label>
                      <Input type="number" {...register("splitGPayAmount")} className="h-9 font-bold border-purple-500/30 bg-purple-50/20" />
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 rounded-xl border border-dashed flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-zinc-900/20">
                <div className="text-xs space-y-0.5">
                  <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-mono font-bold">₹{calculatedBalance.netTotal.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Payment Status:</span> <span className="font-semibold uppercase text-blue-600">{calculatedBalance.status}</span></div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Remaining Balance</span>
                  <span className="text-xl font-black font-mono text-rose-600">₹{calculatedBalance.balance.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 flex flex-row items-center gap-2"><BadgeCheck className="w-4 h-4 text-indigo-500" /><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Delivery & Signature</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Delivered By*</label>
                  <select {...register("deliveredBy")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9 border-blue-500/30 bg-blue-50/20">
                    {TECHNICIANS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Delivery Type*</label>
                  <select {...register("deliveryType")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9 border-blue-500/30 bg-blue-50/20">
                    <option value="Delivered">Successful Delivery</option>
                    <option value="Delivered Return">Return to Customer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Add Warranty</label>
                  <select {...register("warrantyDuration")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9">
                    <option value="No Warranty">No Warranty</option>
                    <option value="1 Month">1 Month</option>
                    <option value="3 Months">3 Months</option>
                    <option value="6 Months">6 Months</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end pt-4 border-t">
            <Button type="submit" disabled={deliveryMutation.isPending} className="h-11 px-10 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md">
              {deliveryMutation.isPending ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Processing...</span> : "Complete Delivery"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
