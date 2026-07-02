import { z } from "zod";

/**
 * Validation schema for Service Job
 */
export const serviceJobSchema = z
  .object({
    // ==========================================
    // 1. SYSTEM METADATA
    // ==========================================
    billNumber: z.string().optional(),
    jobDate: z.string().optional(),

    // ==========================================
    // 2. CUSTOMER PROFILE METADATA SECTION
    // ==========================================
    customerName: z
      .string()
      .min(2, "Customer name must be at least 2 characters")
      .max(70, "Customer name is too long"),
    
    mobileNumber: z
      .string()
      .regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
    
    alternativeNumber: z
      .string()
      .regex(/^[0-9]{10}$/, "Alternative number must be exactly 10 digits")
      .optional()
      .or(z.literal("")),
    
    email: z
      .string()
      .email("Please enter a valid email address")
      .optional()
      .or(z.literal("")),
    
    address: z
      .string()
      .optional()
      .or(z.literal("")),
    
    gstNumber: z
      .string()
      .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Please enter a valid GST number")
      .optional()
      .or(z.literal("")),
    
    customerNotes: z
      .string()
      .max(500, "Notes cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),

    // ==========================================
    // 2. HARDWARE ASSET & DIAGNOSTIC MATRIX
    // ==========================================
    deviceType: z.enum(["Mobile", "Laptop", "PC"], {
      errorMap: () => ({ message: "Please select a valid device type" }),
    }),
    
    brand: z
      .string()
      .min(1, "Please enter or select a brand"),
    
    model: z
      .string()
      .min(1, "Please enter the device model"),
    
    imeiSerialNumber: z
      .string()
      .optional()
      .or(z.literal("")),
    
    devicePasswordPin: z
      .string()
      .max(30, "Password/PIN is too long")
      .optional()
      .or(z.literal("")),
    
    accessoriesReceived: z
      .array(z.string())
      .default([]),
    
    deviceCondition: z
      .string()
      .optional()
      .or(z.literal("")),
    
    complaint: z
      .string()
      .min(1, "Please describe the customer complaint"),

    // ==========================================
    // 3. LIFECYCLE WORKFLOW PIPELINE TRACKS
    // ==========================================
    technicianAssigned: z
      .string()
      .optional()
      .default("Suresh"),
    
    estimatedDeliveryDate: z
      .string()
      .optional()
      .or(z.literal("")),
    
    status: z.string().optional().default("Collected"),
    
    // Conditional Branch Specifications
    returnReason: z.string().optional().or(z.literal("")),
    returnReasonOther: z.string().optional().or(z.literal("")),

    // ==========================================
    // 4. FINANCIAL ACCOUNTING REGISTERS LEDGER
    // ==========================================
    estimatedAmount: z.coerce
      .number()
      .min(0, "Estimated cost cannot be negative"),
    
    advancePaid: z.coerce
      .number()
      .min(0, "Advance paid cannot be negative")
      .default(0),
    
    amountCollected: z.coerce
      .number()
      .min(0, "Amount collected cannot be negative")
      .default(0),
    
    discount: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .default(0),
    
    taxPercentage: z.coerce
      .number()
      .min(0, "Tax cannot be negative")
      .max(100, "Tax cannot exceed 100%")
      .default(0),
    
    paymentMethod: z
      .enum(["Cash", "UPI", "Card", "Bank Transfer"])
      .default("Cash"),

    // ==========================================
    // 5. DELIVERY MODULE DISPATCH METADATA
    // ==========================================
    deliveredBy: z.string().optional().or(z.literal("")),
    receivedBy: z.string().optional().or(z.literal("")),
    customerSignature: z.string().optional().or(z.literal("")), // Holds base64 compression stream
    deliveryRemarks: z.string().optional().or(z.literal("")),

    // ==========================================
    // 6. POST-SERVICE LIFECYCLE WARRANTY SLA
    // ==========================================
    warrantyDuration: z
      .enum(["No Warranty", "7 Days", "15 Days", "30 Days", "60 Days", "90 Days", "6 Months", "1 Year", "Custom"])
      .default("No Warranty"),
    
    customWarrantyDays: z.coerce
      .number()
      .min(0, "Custom warranty days must be positive")
      .optional()
      .default(0),
    
    billedBy: z
      .string()
      .min(1, "Please select who billed the customer"),
  })
  
  // ==========================================================
  // CROSS-FIELD INTERSECT CONDITION REFINEMENT VALIDATIONS
  // ==========================================================
  
  // Validation Intersect Rule A: If status equals 'Returned', require a valid exception reason category block
  .refine(
    (data) => {
      if (data.status === "Returned") {
        return !!data.returnReason && data.returnReason.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please select a reason for returning the device",
      path: ["returnReason"],
    }
  )

  // Validation Intersect Rule B: If resolution breakdown selection is 'Other', mandate custom text description inputs
  .refine(
    (data) => {
      if (data.status === "Returned" && data.returnReason === "Other") {
        return !!data.returnReasonOther && data.returnReasonOther.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please specify the return reason",
      path: ["returnReasonOther"],
    }
  )

  // Validation Intersect Rule C: If status equals 'Delivered', mandate recipient data confirmation fields
  .refine(
    (data) => {
      if (data.status === "Delivered") {
        return !!data.receivedBy && data.receivedBy.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please enter the name of the person who received the device",
      path: ["receivedBy"],
    }
  )

  // Validation Intersect Rule D: If warranty duration is customized, verify that the days input evaluates over 0
  .refine(
    (data) => {
      if (data.warrantyDuration === "Custom") {
        return data.customWarrantyDays !== undefined && data.customWarrantyDays > 0;
      }
      return true;
    },
    {
      message: "Please enter a valid number of warranty days",
      path: ["customWarrantyDays"],
    }
  );

export type ServiceJobFormValues = z.infer<typeof serviceJobSchema>;