import React from "react";
import { QrCode, Smartphone, Laptop, Monitor, ShieldCheck, CheckSquare, Square } from "lucide-react";

// Strict type contract boundaries mapping the normalized DB schema
interface InvoicePrintProps {
  companySettings: {
    company_name: string;
    logo_url?: string;
    address: string;
    phone: string;
    email?: string;
    gst_number?: string;
    terms_conditions?: string;
  };
  jobDetails: {
    bill_number: string;
    created_at: string;
    device_type: "Mobile" | "Laptop" | "PC";
    brand: string;
    model: string;
    imei_serial_number: string;
    device_password_pin?: string;
    accessories_received: string[];
    device_condition: string;
    complaint: string;
    technician_assigned: string;
    estimated_delivery_date: string;
    status: string;
    billed_by: string;
    customers: {
      name: string;
      mobile_number: string;
      alternative_number?: string;
      email?: string;
      address: string;
      gst_number?: string;
    };
    payments: {
      estimated_amount: number;
      advance_paid: number;
      amount_collected: number;
      discount: number;
      tax_percentage: number;
      balance_due: number;
      payment_method: string;
    };
    warranties?: {
      warranty_duration: string;
      warranty_start_date?: string;
      warranty_expiry_date?: string;
      warranty_status: string;
    };
  };
}

const ALL_POSSIBLE_ACCESSORIES = [
  "Charger", "Adapter", "Battery", "Mouse", "Keyboard", 
  "Laptop Bag", "SIM", "Memory Card", "Stylus", "Hard Disk", "SSD", "RAM"
];

export const InvoicePrint = React.forwardRef<HTMLDivElement, InvoicePrintProps>(
  ({ companySettings, jobDetails }, ref) => {
    
    // Compute exact financial metrics dynamically to guarantee data correctness on paper
    const financialSummary = React.useMemo(() => {
      const p = jobDetails.payments;
      const subtotal = p.estimated_amount - p.discount;
      const taxAmount = subtotal * (p.tax_percentage / 100);
      const netPayable = subtotal + taxAmount;
      const collectedTotal = p.advance_paid + p.amount_collected;
      
      return {
        subtotal,
        taxAmount,
        netPayable,
        collectedTotal,
        balanceDue: Math.max(0, netPayable - collectedTotal)
      };
    }, [jobDetails.payments]);

    const renderDeviceTypeBadge = (type: "Mobile" | "Laptop" | "PC") => {
      switch(type) {
        case "Mobile": return <Smartphone className="w-4 h-4 text-zinc-700 inline mr-1" />;
        case "Laptop": return <Laptop className="w-4 h-4 text-zinc-700 inline mr-1" />;
        case "PC": return <Monitor className="w-4 h-4 text-zinc-700 inline mr-1" />;
      }
    };

    return (
      <div 
        ref={ref} 
        className="p-10 bg-white text-black font-sans text-xs tracking-tight w-[210mm] min-h-[297mm] mx-auto flex flex-col justify-between print:p-6 select-none"
        style={{ colorScheme: "light" }}
      >
        <div>
          {/* SECTION 1: MASTER IDENTITY HEADER */}
          <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tighter uppercase text-zinc-900">
                {companySettings.company_name}
              </h1>
              <p className="text-[11px] text-zinc-600 max-w-sm leading-relaxed whitespace-pre-line">
                {companySettings.address}
              </p>
              <div className="text-[10px] font-mono text-zinc-500 pt-1 space-y-0.5">
                <div><span className="font-bold text-zinc-700">Phone:</span> {companySettings.phone}</div>
                {companySettings.email && <div><span className="font-bold text-zinc-700">Email:</span> {companySettings.email}</div>}
                {companySettings.gst_number && <div><span className="font-bold text-zinc-700">GSTIN:</span> {companySettings.gst_number}</div>}
              </div>
            </div>

            <div className="text-right flex flex-col items-end space-y-2">
              <div className="bg-zinc-900 text-white font-bold tracking-widest text-center uppercase py-1 px-3 text-xs rounded">
                Service Work Ticket
              </div>
              <div className="font-mono text-right space-y-0.5 text-[11px]">
                <div><span className="font-bold text-zinc-800">TICKET # :</span> <span className="font-bold text-sm bg-zinc-100 px-1">{jobDetails.bill_number}</span></div>
                <div><span className="font-bold text-zinc-500">Date Logged:</span> {new Date(jobDetails.created_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                <div><span className="font-bold text-zinc-500">Est. Delivery:</span> {new Date(jobDetails.estimated_delivery_date).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CLIENT vs ASSET INFRASTRUCTURE OVERVIEW */}
          <div className="grid grid-cols-2 gap-6 border-b border-zinc-200 py-4">
            <div className="space-y-1">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Customer Details</h3>
              <p className="font-bold text-zinc-900 text-sm">{jobDetails.customers.name}</p>
              <p className="font-mono text-zinc-700">Primary Contact: {jobDetails.customers.mobile_number}</p>
              {jobDetails.customers.alternative_number && <p className="font-mono text-zinc-600">Alt Contact: {jobDetails.customers.alternative_number}</p>}
              <p className="text-zinc-600 leading-normal max-w-xs">{jobDetails.customers.address}</p>
              {jobDetails.customers.gst_number && <p className="font-mono text-[10px] text-zinc-800 font-semibold">Customer GSTIN: {jobDetails.customers.gst_number}</p>}
            </div>

            <div className="space-y-1 border-l pl-6 border-zinc-200">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Device Configuration</h3>
              <p className="font-bold text-zinc-900 text-sm flex items-center">
                {renderDeviceTypeBadge(jobDetails.device_type)}
                {jobDetails.brand} <span className="text-zinc-600 ml-1 font-medium">{jobDetails.model}</span>
              </p>
              <p className="font-mono text-zinc-700 font-semibold">S/N or IMEI: {jobDetails.imei_serial_number}</p>
              {jobDetails.device_password_pin && (
                <p className="text-xs">
                  Handshake Credential PIN/Pattern: <span className="font-mono bg-zinc-100 px-1.5 py-0.5 border rounded font-bold">{jobDetails.device_password_pin}</span>
                </p>
              )}
              <div className="text-[11px] pt-1 text-zinc-600">
                <div><span className="font-medium text-zinc-800">Technician Assigned:</span> {jobDetails.technician_assigned}</div>
                <div><span className="font-medium text-zinc-800">Operator Billed By:</span> {jobDetails.billed_by}</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DIAGNOSTIC CONDITIONS & FAULTS ENTRY */}
          <div className="my-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 border border-zinc-300 rounded p-3 bg-zinc-50/50">
                <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-1">Reported Customer Complaint Matrix</h4>
                <p className="text-zinc-900 whitespace-pre-wrap leading-relaxed font-medium">{jobDetails.complaint}</p>
              </div>
              <div className="border border-zinc-300 rounded p-3">
                <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-1">Check-in Device Condition</h4>
                <p className="text-zinc-700 whitespace-pre-wrap leading-normal">{jobDetails.device_condition}</p>
              </div>
            </div>

            {/* ACCESSORIES CHECKLIST GRID */}
            <div className="border border-zinc-300 rounded p-3">
              <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-2">Peripherals / Accessories Retained Checked Box Grid</h4>
              <div className="grid grid-cols-4 gap-y-1.5 gap-x-2">
                {ALL_POSSIBLE_ACCESSORIES.map((acc) => {
                  const hasAcc = jobDetails.accessories_received?.includes(acc);
                  return (
                    <div key={acc} className={`flex items-center gap-1.5 text-[10px] ${hasAcc ? "font-bold text-zinc-900" : "text-zinc-400"}`}>
                      {hasAcc ? <CheckSquare className="w-3.5 h-3.5 text-zinc-900 shrink-0" /> : <Square className="w-3.5 h-3.5 opacity-40 shrink-0" />}
                      <span className="truncate">{acc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 4: WARRANTY METRICS PROFILES */}
          {jobDetails.warranties && jobDetails.warranties.warranty_duration !== "No Warranty" && (
            <div className="border border-emerald-300 bg-emerald-50/30 rounded p-3 my-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <p className="font-bold text-emerald-900 text-xs">Coverage Protocol Active: {jobDetails.warranties.warranty_duration}</p>
                  <p className="text-[10px] text-emerald-700 font-mono">
                    Timeline: {jobDetails.warranties.warranty_start_date ? new Date(jobDetails.warranties.warranty_start_date).toLocaleDateString('en-IN') : "N/A"} to {jobDetails.warranties.warranty_expiry_date ? new Date(jobDetails.warranties.warranty_expiry_date).toLocaleDateString('en-IN') : "N/A"}
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-[10px] uppercase tracking-wider font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                Status: {jobDetails.warranties.warranty_status}
              </div>
            </div>
          )}

          {/* SECTION 5: FINANCIAL BALANCE OUTSTANDING LEDGER */}
          <div className="flex justify-between items-start mt-6 pt-2 border-t border-zinc-200">
            {/* INVOICE BARCODE EMULATOR DECK */}
            <div className="flex items-center gap-3 bg-zinc-50 border p-2.5 rounded max-w-sm">
              <QrCode className="w-12 h-12 text-zinc-900 stroke-[1.2]" />
              <div className="space-y-0.5">
                <p className="text-[9px] font-bold uppercase text-zinc-500">Electronic Verification Node</p>
                <p className="text-[10px] font-mono font-bold text-zinc-800">{jobDetails.bill_number}</p>
                <p className="text-[8px] text-zinc-400 leading-tight">Scan item within internal client terminals to pull dynamic pipeline workflows.</p>
              </div>
            </div>

            <div className="w-72 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-600">
                <span>Diagnostic Setup Subtotal:</span>
                <span className="font-mono">₹{jobDetails.payments.estimated_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Discretionary Discount Matrix:</span>
                <span className="font-mono">-₹{jobDetails.payments.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 border-b pb-1.5">
                <span>Calculated Tax Index ({jobDetails.payments.tax_percentage}%):</span>
                <span className="font-mono">₹{financialSummary.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-black text-zinc-900 pt-0.5">
                <span>Net Aggregated Total Cost:</span>
                <span className="font-mono text-zinc-950">₹{financialSummary.netPayable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 text-[10px] font-mono border-b border-dashed pb-1.5">
                <span>Deposited Collections (Paid/Adv):</span>
                <span className="font-mono text-zinc-700">₹{financialSummary.collectedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-black bg-zinc-100 p-2 rounded border text-zinc-950">
                <span>REMAINDER BALANCE DUE:</span>
                <span className="font-mono text-rose-700 text-sm">₹{financialSummary.balanceDue.toFixed(2)}</span>
              </div>
              <p className="text-[9px] font-mono text-zinc-400 text-right uppercase">Method: {jobDetails.payments.payment_method}</p>
            </div>
          </div>
        </div>

        {/* SECTION 6: TERMS AGREEMENTS & SECURE FORWARD SIGNATURE BLOCKS */}
        <div className="border-t border-zinc-300 pt-5 mt-auto">
          <div className="text-[9px] text-zinc-500 space-y-1 leading-normal mb-12 max-w-2xl">
            <p className="font-bold uppercase text-zinc-800 tracking-wider">Terms of Operations & Device Diagnostics Agreement:</p>
            <p className="whitespace-pre-line">
              {companySettings.terms_conditions || 
              `1. All diagnostic service tickets remaining unclaimed past 60 days following notice delivery transitions directly into arbitrary liquidation pools.\n2. Service centers hold zero functional liability indexes concerning user data parameters, configurations or physical hardware degradation cascades resulting from structural components fault vectors.`}
            </p>
          </div>

          <div className="flex justify-between items-end text-center text-[11px] pt-4">
            <div className="space-y-4">
              <div className="w-44 border-b border-zinc-400 h-8" />
              <div className="font-semibold text-zinc-600">Client Signature Auth</div>
            </div>
            <div className="space-y-4">
              <div className="w-44 border-b border-zinc-400 h-8" />
              <div className="font-semibold text-zinc-600">Authorized Technician Agent</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

InvoicePrint.displayName = "InvoicePrint";