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
  User, Smartphone, Wallet, BadgeCheck, 
  CheckSquare, Square, Loader2, Printer 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const BRAND_OPTIONS = ["Samsung", "Apple", "Realme", "Vivo", "Oppo", "Xiaomi", "Motorola", "OnePlus", "Google", "Nokia", "Asus", "Sony", "Huawei", "Honor", "Nothing", "Poco", "IQOO", "Dell", "HP", "Lenovo", "Acer", "MSI", "Microsoft", "Razer", "Gigabyte", "LG", "Fujitsu", "Panasonic", "Toshiba", "Other"];
const ACCESSORIES_OPTIONS = ["Charger", "Adapter", "Battery", "Mouse", "Keyboard", "Laptop Bag", "SIM", "Memory Card", "Stylus", "Hard Disk", "SSD", "RAM", "Other"];
const TECHNICIANS = ["Suresh", "Sajith", "Karthik Raj", "Karthi", "Sanjay", "Anandhan", "Karthikeyan", "Unassigned"];

export default function ServiceJobForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { useCreateJobMutation, useUpdateFullJobMutation, useNextBillNumber, useSingleJobQuery } = useServiceJobs();
  
  const createJobMutation = useCreateJobMutation();
  const updateJobMutation = useUpdateFullJobMutation();
  const { data: existingJob, isLoading: loadingExistingJob } = useSingleJobQuery(id);
  const { data: nextBillNumber, isLoading: loadingBillNumber } = useNextBillNumber();

  const [customerId, setCustomerId] = useState<string | null>(null);
  
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
          const extras = [];
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

  // Global Dynamic Reactivity Observers
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
          text += " + " + waterlockExtras.join(" + ");
        }
        setValue("complaint", text, { shouldValidate: true, shouldDirty: true });
      } else if (mobileComplaintType && mobileComplaintType !== "Other") {
        setValue("complaint", mobileComplaintType, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [mobileComplaintType, waterlockExtras, currentDeviceType, setValue]);

  // Financial Ledger Math Elements Observer Engine
  const estAmt = watch("estimatedAmount") || 0;
  const advPaid = watch("advancePaid") || 0;
  const amtColl = watch("amountCollected") || 0;
  const disc = watch("discount") || 0;
  const taxPct = watch("taxPercentage") || 0;

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

  const runCustomerLookup = async (phone: string) => {
    if (phone.length !== 10) return;
    const customers = await localDB.customers.getAll();
    const data = customers.find((c: any) => c.mobile_number === phone);
    if (data) {
      setValue("customerName", data.name);
      setValue("address", data.address);
      setValue("alternativeNumber", data.alternative_number || "");
      setValue("email", data.email || "");
      setValue("gstNumber", data.gst_number || "");
      setValue("customerNotes", data.customer_notes || "");
      toast({ title: "Profile Linked", description: `Auto-populated fields for client: ${data.name}` });
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
    // Extract the numeric part from the bill number (e.g. 00005 -> 5)
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
        console.error("Failed to set sequence", err);
        toast({ variant: "destructive", title: "Update Failed", description: err.message || "Failed to update sequence in the database." });
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
        
        // Match standard parts
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
    // Preserve the current state before creating
    const currentBill = data.billNumber;
    if (isEditMode && id && customerId) {
      updateJobMutation.mutate({ id, values: data, customerId }, {
        onSuccess: () => {
          toast({ title: "Update Complete", description: "Service ticket and financial logs updated cleanly." });
          handleStockDeduction(data);
          setSubmittedJobData({ ...data, id, billNumber: currentBill });
          setIsBillModalOpen(true);
        }
      });
    } else {
      createJobMutation.mutate(data, {
        onSuccess: (newData) => {
          toast({ title: "ERP Operations Complete", description: "Service ticket and financial logs committed cleanly." });
          handleStockDeduction(data);
          setSubmittedJobData({ ...data, id: newData?.id || 'NEW', billNumber: currentBill });
          setIsBillModalOpen(true);
        }
      });
    }
  };

  const handleCloseModalAndNavigate = () => {
    setIsBillModalOpen(false);
    navigate("/customers");
  };

  const handlePrintModal = () => {
    window.print();
  };

  const onFormError = (errors: any) => {
    console.error("Form Validation Errors:", errors);
    toast({ variant: "destructive", title: "Validation Error", description: "Please check the highlighted fields and try again." });
  };

  if (isEditMode && loadingExistingJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Loading job history...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto min-h-screen pb-16 relative z-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">{isEditMode ? "Edit Service Job" : "New Service Job"}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{isEditMode ? "Modify an existing job and update financial ledgers." : "Create a new service job and generate a bill."}</p>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit, onFormError)} className="space-y-6">
        
        {/* CARD ROW 1: CUSTOMER REGISTRATION PROFILE */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Customer Details</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill No:</label>
                {loadingBillNumber ? (
                  <span className="text-xs font-mono animate-pulse bg-muted rounded w-20 h-5 inline-block"></span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input {...register("billNumber")} className="h-6 w-24 text-xs font-mono font-bold bg-muted/50 border-transparent focus-visible:ring-0 px-2" />
                    {!isEditMode && (
                      <Button type="button" variant="outline" onClick={handleSetSequence} className="h-6 px-2 text-[10px] font-bold">
                        Set
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill Date:</label>
                <Input type="date" {...register("jobDate")} className="h-6 w-32 text-xs font-mono font-bold bg-muted/50 border-transparent focus-visible:ring-0 px-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Mobile Number*</label>
              <Input {...register("mobileNumber")} placeholder="Primary 10-digit number" onChange={(e) => { register("mobileNumber").onChange(e); runCustomerLookup(e.target.value); }} />
              {errors.mobileNumber && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.mobileNumber.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Full Name*</label>
              <Input {...register("customerName")} placeholder="Full Name" />
              {errors.customerName && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.customerName.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Alternative Number</label>
              <Input {...register("alternativeNumber")} placeholder="Alternative phone (optional)" />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-semibold block mb-1">Address</label>
              <Input {...register("address")} placeholder="Customer Address (optional)" />
            </div>
          </CardContent>
        </Card>

        {/* CARD ROW 2: HARDWARE ASSET & DIAGNOSTICS DECK */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 flex flex-row items-center gap-2"><Smartphone className="w-4 h-4 text-purple-500" /><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Device Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Device Type*</label>
              <select {...register("deviceType")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9">
                <option value="Mobile">Mobile</option>
                <option value="Laptop">Laptop</option>
                <option value="PC">PC</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Brand*</label>
              <select {...register("brand")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9">
                {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Model*</label>
              <Input {...register("model")} placeholder="e.g., iPhone 15 Pro, ThinkPad X1" />
              {errors.model && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.model.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Device Password/PIN</label>
              <Input {...register("devicePasswordPin")} placeholder="Password or PIN to access device" />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-semibold block mb-2">Accessories Received</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 bg-muted/20 p-3 rounded-lg border">
                {ACCESSORIES_OPTIONS.map((acc) => {
                  const isChecked = accessoriesReceived.includes(acc);
                  return (
                    <button type="button" key={acc} onClick={() => handleAccessoryToggle(acc)} className="flex items-center gap-2 text-left select-none text-xs font-medium opacity-80 hover:opacity-100">
                      {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-muted-foreground/40" />}
                      <span>{acc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-semibold block mb-1">Customer Complaint*</label>
              
              {currentDeviceType === "Mobile" ? (
                <div className="space-y-3">
                  <select 
                    value={mobileComplaintType}
                    onChange={(e) => setMobileComplaintType(e.target.value)}
                    className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9"
                  >
                    <option value="">Select a complaint...</option>
                    <option value="Display">Display</option>
                    <option value="CC">CC</option>
                    <option value="Battery">Battery</option>
                    <option value="IC">IC</option>
                    <option value="Waterlock">Waterlock</option>
                    <option value="Motherboard">Motherboard</option>
                    <option value="Camera">Camera</option>
                    <option value="Flashing">Flashing</option>
                    <option value="Repaste">Repaste</option>
                    <option value="Other">Other</option>
                  </select>

                  {mobileComplaintType === "Waterlock" && (
                    <div className="flex flex-wrap gap-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 w-full mb-1">Additional Issues:</span>
                      {["Display", "CC", "Battery"].map(extra => (
                        <button
                          key={extra}
                          type="button"
                          onClick={() => handleWaterlockExtraToggle(extra)}
                          className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
                            waterlockExtras.includes(extra) 
                              ? "bg-blue-600 text-white shadow-sm" 
                              : "bg-white dark:bg-zinc-800 border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          + {extra}
                        </button>
                      ))}
                    </div>
                  )}

                  {mobileComplaintType === "Other" && (
                    <textarea {...register("complaint")} placeholder="Describe the issue reported by the customer..." className="w-full border rounded-lg p-2 text-xs font-medium bg-background h-20 min-h-[80px]" />
                  )}
                  {/* Hidden input to ensure validation works when not using 'Other' */}
                  {mobileComplaintType !== "Other" && (
                    <input type="hidden" {...register("complaint")} />
                  )}
                </div>
              ) : (
                <textarea {...register("complaint")} placeholder="Describe the issue reported by the customer..." className="w-full border rounded-lg p-2 text-xs font-medium bg-background h-20 min-h-[80px]" />
              )}
              {errors.complaint && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.complaint.message}</p>}
            </div>
          </CardContent>
        </Card>


        {/* CARD ROW 4: FINANCIAL ACCOUNTING LEDGER SYSTEM */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 flex flex-row items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Billing & Payment</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Estimated Cost (₹)</label>
                <Input type="number" {...register("estimatedAmount")} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Advance Paid</label>
                <Input type="number" {...register("advancePaid")} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Amount Collected</label>
                <Input type="number" {...register("amountCollected")} className="h-9" />
              </div>
            </div>

            {/* LIVE DYNAMIC RUNTIME COMPUTATION REPORT STRIP */}
            <div className="p-4 rounded-xl border border-dashed flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-zinc-900/20">
              <div className="text-xs space-y-0.5">
                <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-mono font-bold">₹{calculatedBalance.netTotal.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Payment Status:</span> <span className="font-semibold uppercase text-blue-600">{calculatedBalance.status}</span></div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Balance Due</span>
                <span className="text-xl font-black font-mono text-rose-600">₹{calculatedBalance.balance.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold block mb-1">Billed By*</label>
                <select {...register("billedBy")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9">
                  {TECHNICIANS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.billedBy && <p className="text-[10px] text-rose-500 font-medium mt-1">{errors.billedBy.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD ROW 5: DELIVERY MODULE HANDSHAKE VERIFICATION & CANVASES */}
        {currentStatus === "Delivered" && (
          <Card className="shadow-sm border-border animate-slideUp">
            <CardHeader className="pb-3 flex flex-row items-center gap-2"><BadgeCheck className="w-4 h-4 text-indigo-500" /><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Delivery & Signature</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Delivered By</label>
                  <select {...register("deliveredBy")} className="w-full border rounded-lg p-2 bg-background text-xs font-medium h-9">
                    {TECHNICIANS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Received By</label>
                  <Input {...register("receivedBy")} placeholder="Name of person receiving the device" className="h-9" />
                </div>
                
                {consumesStock && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold block mb-1 text-blue-600 dark:text-blue-400">Spare Part Purchased From</label>
                    <select {...register("sparePartSupplier")} className="w-full border rounded-lg p-2 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/40 text-xs font-bold h-9">
                      <option value="">-- Do Not Track Stock --</option>
                      <option value="Kaveri">Kaveri</option>
                      <option value="Surya">Surya</option>
                      <option value="Bangalore">Bangalore</option>
                      <option value="Cell Care">Cell Care</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">Selecting a supplier will automatically deduct 1 part from the inventory list upon saving.</p>
                  </div>
                )}
              </div>
              <div className="w-full">
                  <SignatureCanvas onSaveSignature={(base64: string) => setValue("customerSignature", base64)} />
              </div>
            </CardContent>
          </Card>
        )}



        {/* MASTER ERP EXECUTION SWITCHSTICK DECK BAR */}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="h-11 px-8 font-bold rounded-xl shadow-sm">
            Cancel
          </Button>
          <Button type="submit" disabled={createJobMutation.isPending || updateJobMutation.isPending} className="h-11 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/10">
            {createJobMutation.isPending || updateJobMutation.isPending ? (
              <span className="flex items-center gap-2 font-mono uppercase tracking-wider text-xs"><Loader2 className="w-4 h-4 animate-spin"/> {isEditMode ? "Updating..." : "Saving..."}</span>
            ) : (isEditMode ? "Update Service Job" : "Save Service Job")}
          </Button>
        </div>
      </form>

      {/* SERVICE JOB BILL POPUP MODAL */}
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
        <DialogContent className="sm:max-w-[400px] print-bill-container bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-center border-b pb-3 mb-2 print-hidden">Service Job Receipt</DialogTitle>
          </DialogHeader>
          
          {submittedJobData && (
            <div className="space-y-4 text-sm print-section">
              {/* Header inside print area */}
              <div className="text-center pb-2 border-b-2 border-dashed">
                <h2 className="text-lg font-black uppercase">Service Job Bill</h2>
                <div className="mt-2 mb-2 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest font-bold">Bill No</span>
                  <span className="text-3xl font-black font-mono text-foreground leading-none mt-0.5">{submittedJobData.billNumber}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">Date: {submittedJobData.jobDate}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Customer</p>
                  <p className="font-semibold text-xs">{submittedJobData.customerName}</p>
                  <p className="font-mono text-[10px]">{submittedJobData.mobileNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Device</p>
                  <p className="font-semibold text-xs">{submittedJobData.brand} {submittedJobData.model}</p>
                </div>
              </div>

              <div className="bg-muted/30 p-2 rounded-lg border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Complaint / Issue</p>
                <p className="text-[11px] font-medium leading-tight">{submittedJobData.complaint}</p>
              </div>

              <div className="flex justify-between items-center py-2 border-y border-dashed">
                <p className="text-[11px] font-bold uppercase tracking-wider">Estimated Amt</p>
                <p className="text-sm font-black font-mono">₹{Number(submittedJobData.estimatedAmount).toFixed(2)}</p>
              </div>

              <div className="text-[8px] leading-[1.2] text-muted-foreground pt-1 text-justify">
                <strong>Terms & Conditions:</strong> Delivery date may be delayed incase of spare parts and software unavailability. All Estimate cost are Approximate &amp; subject to change on completion of the job. All articles taken for repairs are subject to owner’s risk. The company will do its best to complete job in time but not responsible for any foreseen already in completing job on the due date. Damage to the semi defective parts during servicing cannot be hold responsible while servicing certain equipments parts of modification in the circuit require will be done. The company is not responsible for goods not takes beyond 30 days from the date of job card. Old defective parts will not returned. Incase the job is not completed of estimation not being passed minimum service charges has Rs. 50.00 be paid. Only Checking Warranty.
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between mt-6 print-hidden">
            <Button variant="outline" onClick={handleCloseModalAndNavigate}>
              Close & Return
            </Button>
            <Button onClick={handlePrintModal} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}