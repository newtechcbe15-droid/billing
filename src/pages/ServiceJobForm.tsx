import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { localDB, generateId } from "@/lib/localDB";
import { serviceJobSchema, ServiceJobFormValues } from "@/schemas/validationSchema";
import { useServiceJobs } from "@/hooks/useServiceJobs";
import { SignatureCanvas } from "@/components/service-job/SignatureCanvas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Smartphone, 
  Laptop, 
  Monitor, 
  Wallet, 
  BadgeCheck, 
  Check, 
  Loader2, 
  Printer, 
  Calendar,
  Lock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useStaffRoster } from "@/lib/staffRoster";

const BRAND_OPTIONS = ["Samsung", "Apple", "Realme", "Vivo", "Oppo", "Xiaomi", "Motorola", "OnePlus", "Google", "Nokia", "Asus", "Sony", "Huawei", "Honor", "Nothing", "Poco", "IQOO", "Dell", "HP", "Lenovo", "Acer", "MSI", "Microsoft", "Razer", "Gigabyte", "LG", "Fujitsu", "Panasonic", "Toshiba", "Other"];
const ACCESSORIES_OPTIONS = ["Charger", "Adapter", "Battery", "Mouse", "Keyboard", "Laptop Bag", "SIM", "Memory Card", "Stylus", "Hard Disk", "SSD", "RAM", "Other"];
const PRESET_COMPLAINTS = ["Display", "CC", "Battery", "IC", "Waterlock", "Motherboard", "Camera", "Flashing", "Repaste", "Other"];

export default function ServiceJobForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staffList } = useStaffRoster();
  const { useCreateJobMutation, useUpdateFullJobMutation, useNextBillNumber, useSingleJobQuery } = useServiceJobs();
  
  const createJobMutation = useCreateJobMutation();
  const updateJobMutation = useUpdateFullJobMutation();
  const { data: existingJob, isLoading: loadingExistingJob } = useSingleJobQuery(id);
  const { data: nextBillNumber, isLoading: loadingBillNumber } = useNextBillNumber();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [existingCustomerFound, setExistingCustomerFound] = useState<string | null>(null);
  
  // States for the Bill Modal
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [submittedJobData, setSubmittedJobData] = useState<any>(null);

  // States for Mobile Complaint Selector
  const [mobileComplaintType, setMobileComplaintType] = useState<string>("");
  const [waterlockExtras, setWaterlockExtras] = useState<string[]>([]);

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<ServiceJobFormValues>({
    resolver: zodResolver(serviceJobSchema),
    defaultValues: {
      accessoriesReceived: [],
      status: "Received",
      deviceType: "Mobile",
      brand: "Samsung",
      technicianAssigned: "Suresh",
      billedBy: "Suresh",
      estimatedAmount: 0,
      advancePaid: 0,
      amountCollected: 0,
      discount: 0,
      taxPercentage: 0,
      paymentMethod: "Cash",
      warrantyDuration: "No Warranty",
      customWarrantyDays: 0,
      jobDate: new Date().toISOString().split('T')[0]
    }
  });

  useEffect(() => {
    if (!isEditMode && nextBillNumber) {
      setValue("billNumber", nextBillNumber);
    }
  }, [nextBillNumber, setValue, isEditMode]);

  useEffect(() => {
    if (isEditMode && existingJob) {
      setCustomerId(existingJob.customers?.id || null);
      reset({
        billNumber: existingJob.bill_number,
        jobDate: existingJob.created_at.split('T')[0],
        customerName: existingJob.customers?.name || "",
        mobileNumber: existingJob.customers?.mobile_number || "",
        alternativeNumber: (existingJob.customers as any)?.alternative_number || "",
        email: (existingJob.customers as any)?.email || "",
        address: existingJob.customers?.address || "",
        gstNumber: (existingJob.customers as any)?.gst_number || "",
        customerNotes: (existingJob.customers as any)?.customer_notes || "",
        deviceType: (existingJob as any).device_type || existingJob.deviceType,
        brand: existingJob.brand,
        model: existingJob.model,
        imeiSerialNumber: (existingJob as any).imei_serial_number || "",
        devicePasswordPin: (existingJob as any).device_password_pin || "",
        accessoriesReceived: (existingJob as any).accessories_received || [],
        deviceCondition: (existingJob as any).device_condition || "",
        complaint: (existingJob as any).complaint || "",
        technicianAssigned: (existingJob as any).technician_assigned || existingJob.technicianAssigned,
        estimatedDeliveryDate: (existingJob as any).estimated_delivery_date || "",
        status: existingJob.status as any,
        returnReason: (existingJob as any).return_reason || "",
        returnReasonOther: (existingJob as any).return_reason_other || "",
        estimatedAmount: existingJob.payments?.estimated_amount || 0,
        advancePaid: existingJob.payments?.advance_paid || 0,
        amountCollected: existingJob.payments?.amount_collected || 0,
        discount: existingJob.payments?.discount || 0,
        taxPercentage: existingJob.payments?.tax_percentage || 0,
        paymentMethod: existingJob.payments?.payment_method as any || "Cash",
        deliveredBy: (existingJob as any).delivered_by || "",
        receivedBy: (existingJob as any).received_by || "",
        customerSignature: (existingJob as any).customer_signature || "",
        deliveryRemarks: (existingJob as any).delivery_remarks || "",
        sparePartSupplier: (existingJob as any).spare_part_supplier || "",
        warrantyDuration: existingJob.warranties?.warranty_duration as any || "No Warranty",
        customWarrantyDays: (existingJob as any).custom_warranty_days || 0,
        billedBy: (existingJob as any).billed_by || "Suresh"
      });
      
      // Initialize Mobile Complaint State if it matches a preset
      if ((existingJob as any).device_type === "Mobile" || existingJob.deviceType === "Mobile") {
        const comp = (existingJob as any).complaint || "";
        if (comp.startsWith("Waterlock")) {
          setMobileComplaintType("Waterlock");
          const extras: string[] = [];
          if (comp.toLowerCase().includes("display")) extras.push("Display");
          if (comp.toLowerCase().includes("cc")) extras.push("CC");
          if (comp.toLowerCase().includes("battery")) extras.push("Battery");
          setWaterlockExtras(extras);
        } else if (["Display", "CC", "Battery", "IC", "Motherboard", "Camera", "Flashing", "Repaste"].includes(comp)) {
          setMobileComplaintType(comp);
        } else if (comp) {
          setMobileComplaintType("Other");
        }
      }
    }
  }, [isEditMode, existingJob, reset]);

  // Global Dynamic Observers
  const currentStatus = useWatch({ control, name: "status" });
  const accessoriesReceived = watch("accessoriesReceived") || [];
  const currentDeviceType = watch("deviceType") || "Mobile";
  const currentComplaint = watch("complaint") || "";

  // Check if current job consumes stock parts
  const consumesStock = currentDeviceType === "Mobile" && (
    currentComplaint.toLowerCase().includes("display") || 
    currentComplaint.toLowerCase().includes("battery") || 
    currentComplaint.toLowerCase().includes("cc")
  );

  // Sync Mobile Complaint State to Form Value
  useEffect(() => {
    if (currentDeviceType === "Mobile") {
      if (mobileComplaintType === "Waterlock") {
        let text = "Waterlock";
        if (waterlockExtras.length > 0) {
          text += ` (${waterlockExtras.join(", ")})`;
        }
        setValue("complaint", text, { shouldValidate: true });
      } else if (mobileComplaintType && mobileComplaintType !== "Other") {
        setValue("complaint", mobileComplaintType, { shouldValidate: true });
      }
    }
  }, [mobileComplaintType, waterlockExtras, currentDeviceType, setValue]);

  // Reactive financial calculations
  const estAmt = Number(watch("estimatedAmount") || 0);
  const advPaid = Number(watch("advancePaid") || 0);
  const amtColl = Number(watch("amountCollected") || 0);
  const disc = Number(watch("discount") || 0);
  const taxPct = Number(watch("taxPercentage") || 0);

  const calculatedBalance = React.useMemo(() => {
    const subtotal = Math.max(0, estAmt - disc);
    const taxAmt = subtotal * (taxPct / 100);
    const netTotal = subtotal + taxAmt;
    const paidTotal = advPaid + amtColl;
    const balance = Math.max(0, netTotal - paidTotal);

    let status = "Unpaid";
    if (paidTotal >= netTotal && netTotal > 0) {
      status = "Paid";
    } else if (paidTotal > 0) {
      status = "Partially Paid";
    }

    return { subtotal, netTotal, balance, status, paidTotal };
  }, [estAmt, advPaid, amtColl, disc, taxPct]);

  // Customer Mobile Lookup
  const runCustomerLookup = async (phone: string) => {
    if (phone.length !== 10) {
      setExistingCustomerFound(null);
      return;
    }
    const customers = await localDB.customers.getAll();
    const data = customers.find((c: any) => c.mobile_number === phone);
    if (data) {
      setCustomerId(data.id);
      setExistingCustomerFound(data.name);
      setValue("customerName", data.name, { shouldValidate: true });
      if (data.alternative_number) setValue("alternativeNumber", data.alternative_number);
      if (data.email) setValue("email", data.email);
      if (data.address) setValue("address", data.address);
      if (data.gst_number) setValue("gstNumber", data.gst_number);
      if (data.customer_notes) setValue("customerNotes", data.customer_notes);
      toast({ title: "Profile Linked", description: `Auto-populated fields for client: ${data.name}` });
    } else {
      setExistingCustomerFound(null);
    }
  };

  const handleAccessoryToggle = (value: string) => {
    const nextValue = accessoriesReceived.includes(value)
      ? accessoriesReceived.filter((v) => v !== value)
      : [...accessoriesReceived, value];
    setValue("accessoriesReceived", nextValue);
  };

  const handleWaterlockExtraToggle = (value: string) => {
    setWaterlockExtras(prev => 
      prev.includes(value) ? prev.filter((v: string) => v !== value) : [...prev, value]
    );
  };

  const handleSetSequence = async () => {
    const currentBill = watch("billNumber");
    if (!currentBill) return;
    const match = currentBill.match(/\d+$/);
    if (match) {
      const nextNum = parseInt(match[0], 10);
      try {
        const settings = await localDB.settings.get();
        settings.next_bill_number = nextNum;
        await localDB.settings.save(settings);
        queryClient.invalidateQueries({ queryKey: ["nextBillNumber"] });
        toast({ title: "Sequence Updated", description: `Next bill number sequence set to start from ${nextNum}.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Update Failed", description: err.message || "Failed to update sequence." });
      }
    } else {
      toast({ variant: "destructive", title: "Invalid Format", description: "Could not find a number at the end of the bill." });
    }
  };

  const handleStockDeduction = async (data: ServiceJobFormValues) => {
    if (data.status === "Delivered" && data.sparePartSupplier && consumesStock) {
      try {
        const stocks = await localDB.stock.getAll();
        const cText = data.complaint.toLowerCase();
        let partName = "";
        
        if (cText.includes("display")) partName = "Display";
        else if (cText.includes("battery")) partName = "Battery";
        else if (cText.includes("cc")) partName = "CC";
        
        if (partName) {
          const matchIdx = stocks.findIndex((s: any) => s.item === partName && s.buyed_from === data.sparePartSupplier);
          if (matchIdx !== -1) {
            stocks[matchIdx].quantity = Math.max(0, stocks[matchIdx].quantity - 1);
            await localDB.stock.save([stocks[matchIdx]]);
            toast({ title: "Stock Deducted", description: `1 ${partName} deducted from ${data.sparePartSupplier} inventory.` });
          } else {
            const newStock = {
              id: generateId(),
              item: partName,
              buyed_from: data.sparePartSupplier,
              quantity: -1,
              supported_model: data.model,
              box_no: "",
              created_at: new Date().toISOString()
            };
            await localDB.stock.save([newStock]);
            toast({ title: "Stock Alert", description: `Negative stock entry created for ${partName} (${data.sparePartSupplier}).` });
          }
        }
      } catch (err) {
        console.error("Stock update failed", err);
      }
    }
  };

  const onFormSubmit = async (data: ServiceJobFormValues) => {
    const currentBill = data.billNumber;
    if (isEditMode && id && customerId) {
      updateJobMutation.mutate({ id, values: data, customerId }, {
        onSuccess: () => {
          toast({ title: "Update Complete", description: "Service ticket and financial logs updated." });
          handleStockDeduction(data);
          setSubmittedJobData({ ...data, id, billNumber: currentBill });
          setIsBillModalOpen(true);
        }
      });
    } else {
      createJobMutation.mutate(data, {
        onSuccess: (newData) => {
          toast({ title: "Ticket Created", description: "Service ticket registered successfully." });
          handleStockDeduction(data);
          setSubmittedJobData({ ...data, id: newData?.id || 'NEW', billNumber: currentBill });
          setIsBillModalOpen(true);
        }
      });
    }
  };

  const handleCloseModalAndNavigate = () => {
    setIsBillModalOpen(false);
    navigate("/reports");
  };

  const handlePrintModal = () => {
    window.print();
  };

  const onFormError = (errs: any) => {
    console.error("Form Errors:", errs);
    toast({ variant: "destructive", title: "Validation Error", description: "Please review the highlighted fields." });
  };

  if (isEditMode && loadingExistingJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-mono text-muted-foreground tracking-wide">Loading ticket history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              {isEditMode ? `Edit Service Job #${watch("billNumber") || ""}` : "New Service Job & Billing"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEditMode 
              ? "Modify existing ticket attributes, diagnosis, and financial settlement." 
              : "Register customer device, issue diagnosis, and generate service receipt."}
          </p>
        </div>

        {/* Bill Sequence and Date Controls */}
        <div className="flex items-center gap-3 bg-card/80 border border-border/80 p-1.5 px-3 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Bill #</span>
            {loadingBillNumber ? (
              <span className="w-16 h-6 bg-muted/60 animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-1">
                <Input 
                  {...register("billNumber")} 
                  className="h-7 w-20 text-xs font-mono font-black text-center bg-muted/50 border-border/60 shadow-none px-1" 
                />
                {!isEditMode && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleSetSequence} 
                    className="h-7 px-2 text-[10px] font-bold rounded-lg"
                  >
                    Set
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border/80" />

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              type="date" 
              {...register("jobDate")} 
              className="h-7 w-32 text-xs font-mono font-semibold bg-muted/50 border-border/60 shadow-none px-2" 
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit, onFormError)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Customer + Device + Lifecycle (2 Spans) */}
        <div className="lg:col-span-2 space-y-6">

          {/* CARD 1: CUSTOMER PROFILE */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Customer Profile
                </CardTitle>
              </div>

              {existingCustomerFound && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Returning Client: {existingCustomerFound}
                </span>
              )}
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5 text-foreground">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <Input 
                  {...register("mobileNumber")} 
                  placeholder="Primary 10-digit mobile" 
                  maxLength={10}
                  className="h-10 text-xs font-mono rounded-xl"
                  onChange={(e) => { 
                    register("mobileNumber").onChange(e); 
                    runCustomerLookup(e.target.value); 
                  }} 
                />
                {errors.mobileNumber && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.mobileNumber.message}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5 text-foreground">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <Input 
                  {...register("customerName")} 
                  placeholder="Customer Full Name" 
                  className="h-10 text-xs rounded-xl"
                />
                {errors.customerName && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.customerName.message}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5 text-foreground">Alternative Number</label>
                <Input 
                  {...register("alternativeNumber")} 
                  placeholder="Alternative contact (optional)" 
                  maxLength={10}
                  className="h-10 text-xs font-mono rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5 text-foreground">Address</label>
                <Input 
                  {...register("address")} 
                  placeholder="Locality / Address (optional)" 
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* CARD 2: HARDWARE ASSET & DIAGNOSTICS */}
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Device Hardware & Diagnostics
                </CardTitle>
              </div>

              {/* Device Type Selector Pills */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                {(["Mobile", "Laptop", "PC"] as const).map((type) => {
                  const isSelected = currentDeviceType === type;
                  const Icon = type === "Mobile" ? Smartphone : type === "Laptop" ? Laptop : Monitor;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setValue("deviceType", type, { shouldValidate: true })}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{type}</span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">
                    Brand <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    {...register("brand")} 
                    className="w-full border border-input rounded-xl px-3 bg-background text-xs font-semibold h-10 outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">
                    Model <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    {...register("model")} 
                    placeholder="e.g. iPhone 15, ThinkPad X1" 
                    className="h-10 text-xs rounded-xl font-medium"
                  />
                  {errors.model && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.model.message}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Password / PIN</span>
                  </label>
                  <Input 
                    {...register("devicePasswordPin")} 
                    placeholder="Screen lock / PIN" 
                    className="h-10 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              {/* Accessories Received Chips */}
              <div>
                <label className="text-xs font-semibold block mb-2 text-foreground">
                  Accessories Received
                </label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/30 border border-border/60">
                  {ACCESSORIES_OPTIONS.map((acc) => {
                    const isChecked = accessoriesReceived.includes(acc);
                    return (
                      <button
                        type="button"
                        key={acc}
                        onClick={() => handleAccessoryToggle(acc)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none ${
                          isChecked
                            ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 scale-[1.02]"
                            : "bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${isChecked ? "bg-white/20 text-white" : "border border-border"}`}>
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{acc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Complaint Section */}
              <div>
                <label className="text-xs font-semibold block mb-2 text-foreground">
                  Customer Complaint / Reported Problem <span className="text-rose-500">*</span>
                </label>

                {currentDeviceType === "Mobile" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COMPLAINTS.map((c) => {
                        const isSelected = mobileComplaintType === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setMobileComplaintType(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>

                    {/* Waterlock Additional Sub-issues */}
                    {mobileComplaintType === "Waterlock" && (
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 space-y-2 animate-fadeIn">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                          Waterlock Damaged Sub-parts:
                        </span>
                        <div className="flex gap-2">
                          {["Display", "CC", "Battery"].map((extra) => (
                            <button
                              key={extra}
                              type="button"
                              onClick={() => handleWaterlockExtraToggle(extra)}
                              className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                                waterlockExtras.includes(extra)
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              + {extra}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {mobileComplaintType === "Other" && (
                      <textarea
                        {...register("complaint")}
                        placeholder="Detail the defect or service request..."
                        className="w-full border border-input rounded-xl p-3 text-xs bg-background h-24 outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}
                    {mobileComplaintType !== "Other" && (
                      <input type="hidden" {...register("complaint")} />
                    )}
                  </div>
                ) : (
                  <textarea
                    {...register("complaint")}
                    placeholder="Describe the issue reported by the customer..."
                    className="w-full border border-input rounded-xl p-3 text-xs bg-background h-24 outline-none focus:ring-2 focus:ring-primary/40"
                  />
                )}
                {errors.complaint && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.complaint.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CARD 3: HANDOVER & SIGNATURE (When status is Delivered) */}
          {currentStatus === "Delivered" && (
            <Card className="cockpit-card rounded-2xl overflow-hidden animate-slideUp">
              <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <BadgeCheck className="w-4 h-4" />
                </div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Delivery Handover & Recipient
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div>
                    <label className="text-xs font-semibold block mb-1.5 text-foreground">
                      Received By <span className="text-rose-500">*</span>
                    </label>
                    <Input 
                      {...register("receivedBy")} 
                      placeholder="Name of recipient" 
                      className="h-10 text-xs rounded-xl"
                    />
                    {errors.receivedBy && (
                      <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.receivedBy.message}</p>
                    )}
                  </div>

                  {consumesStock && (
                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <label className="text-xs font-bold block mb-1 text-blue-600 dark:text-blue-400">
                        Spare Part Supplier (Auto-Stock Deduction)
                      </label>
                      <select 
                        {...register("sparePartSupplier")} 
                        className="w-full border border-blue-300 dark:border-blue-800 rounded-xl px-3 bg-background text-xs font-bold h-10 outline-none"
                      >
                        <option value="">-- Do Not Deduct Stock --</option>
                        <option value="Kaveri">Kaveri</option>
                        <option value="Surya">Surya</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Cell Care">Cell Care</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Saving as Delivered will automatically decrement 1 part from the chosen supplier's inventory.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">Customer Signature</label>
                  <SignatureCanvas onSaveSignature={(base64: string) => setValue("customerSignature", base64)} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Financial Summary & Actions (1 Span) */}
        <div className="space-y-6">

          {/* FINANCIAL ACCOUNTING CARD */}
          <Card className="cockpit-card rounded-2xl overflow-hidden sticky top-20">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Financial Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">
                    Estimated Cost (₹)
                  </label>
                  <Input 
                    type="number" 
                    step="any"
                    {...register("estimatedAmount")} 
                    className="h-10 text-sm font-mono font-bold rounded-xl"
                  />
                  {errors.estimatedAmount && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.estimatedAmount.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">
                      Advance Paid (₹)
                    </label>
                    <Input 
                      type="number" 
                      step="any"
                      {...register("advancePaid")} 
                      className="h-9 text-xs font-mono font-medium rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">
                      Collected (₹)
                    </label>
                    <Input 
                      type="number" 
                      step="any"
                      {...register("amountCollected")} 
                      className="h-9 text-xs font-mono font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">Discount (₹)</label>
                    <Input 
                      type="number" 
                      step="any"
                      {...register("discount")} 
                      className="h-9 text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-foreground">Tax (%)</label>
                    <Input 
                      type="number" 
                      step="any"
                      {...register("taxPercentage")} 
                      className="h-9 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Dynamic Financial Breakdown Pill */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Net Payable</span>
                  <span className="font-mono font-bold text-foreground">₹{calculatedBalance.netTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Paid Total</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹{calculatedBalance.paidTotal.toFixed(2)}
                  </span>
                </div>
                <div className="h-px bg-border/80" />
                <div className="flex justify-between items-center pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Balance Due
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                      {calculatedBalance.status}
                    </span>
                  </div>
                  <span className={`text-2xl font-black font-mono ${calculatedBalance.balance > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                    ₹{calculatedBalance.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Billed By & Payment Method */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Billed By</label>
                  <select 
                    {...register("billedBy")} 
                    className="w-full border border-input rounded-xl px-2.5 bg-background text-xs font-semibold h-9 outline-none"
                  >
                    {[...staffList, "Unassigned"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Payment Method</label>
                  <select 
                    {...register("paymentMethod")} 
                    className="w-full border border-input rounded-xl px-2.5 bg-background text-xs font-semibold h-9 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button 
                  type="submit" 
                  disabled={createJobMutation.isPending || updateJobMutation.isPending} 
                  className="w-full h-11 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
                >
                  {createJobMutation.isPending || updateJobMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </span>
                  ) : isEditMode ? (
                    "Update Service Job"
                  ) : (
                    "Save & Generate Receipt"
                  )}
                </Button>

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)} 
                  className="w-full h-9 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* SERVICE JOB RECEIPT POPUP DIALOG */}
      <Dialog open={isBillModalOpen} onOpenChange={(open) => !open && handleCloseModalAndNavigate()}>
        {isBillModalOpen && (
          <style>
            {`
              @media print {
                @page { size: 10cm 15cm; margin: 0; }
                body { margin: 0; padding: 0; background: #fff; }
                #root { display: none !important; }
                .print-bill-container { 
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  transform: none !important;
                  width: 10cm !important; 
                  height: 15cm !important; 
                  padding: 8mm !important; 
                  margin: 0 !important; 
                  overflow: hidden;
                  box-sizing: border-box;
                }
              }
            `}
          </style>
        )}
        <DialogContent className="sm:max-w-[420px] print-bill-container bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase text-center border-b pb-3 mb-1 print-hidden text-foreground">
              Service Job Receipt Preview
            </DialogTitle>
          </DialogHeader>
          
          {submittedJobData && (
            <div className="space-y-3.5 text-xs print-section">
              {/* Receipt Header */}
              <div className="text-center pb-2.5 border-b-2 border-dashed border-border/80">
                <h2 className="text-base font-black uppercase text-foreground">NEW TECHNOLOGY</h2>
                <p className="text-[10px] text-muted-foreground">Mobile & Laptop Service Centre • Singanallur</p>
                <div className="mt-2 mb-1 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest font-bold">Ticket No</span>
                  <span className="text-2xl font-black font-mono text-primary leading-none mt-0.5">{submittedJobData.billNumber}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">Date: {submittedJobData.jobDate}</p>
              </div>

              {/* Customer & Asset Summary */}
              <div className="grid grid-cols-2 gap-3 bg-muted/20 p-2.5 rounded-xl border border-border/60">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Customer</p>
                  <p className="font-bold text-xs text-foreground">{submittedJobData.customerName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{submittedJobData.mobileNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Asset</p>
                  <p className="font-bold text-xs text-foreground">{submittedJobData.brand} {submittedJobData.model}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{submittedJobData.deviceType}</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Reported Defect</p>
                <p className="text-[11px] font-medium text-foreground leading-tight">{submittedJobData.complaint}</p>
              </div>

              <div className="flex justify-between items-center py-2 border-y border-dashed border-border/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estimated Amount</span>
                <span className="text-base font-black font-mono text-foreground">₹{Number(submittedJobData.estimatedAmount).toFixed(2)}</span>
              </div>

              <div className="text-[7.5px] leading-[1.25] text-muted-foreground pt-1 text-justify">
                <strong>Terms:</strong> Delivery date may vary based on spare availability. Estimate is subject to final testing. Minimum checking charge applies. Goods not collected within 30 days are subject to shop disposal policy.
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between mt-4 print-hidden gap-2">
            <Button variant="outline" size="sm" onClick={handleCloseModalAndNavigate} className="text-xs">
              Close & View Reports
            </Button>
            <Button onClick={handlePrintModal} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}