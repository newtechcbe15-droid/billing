import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { ServiceJobFormValues } from "@/schemas/validationSchema";
import { useToast } from "@/hooks/use-toast";

// Explicit Domain Contract Types
export interface ServiceJobPayload extends ServiceJobFormValues {
  id: string;
  bill_number: string;
  created_at: string;
  updated_at: string;
  customers: {
    id: string;
    name: string;
    mobile_number: string;
    address: string;
  };
  payments: {
    id: string;
    estimated_amount: number;
    advance_paid: number;
    amount_collected: number;
    discount: number;
    tax_percentage: number;
    balance_due: number;
    payment_status: "Paid" | "Partially Paid" | "Unpaid";
    payment_method: "Cash" | "UPI" | "Card" | "Bank Transfer";
  } | null;
  warranties?: {
    id: string;
    warranty_duration: string;
    warranty_start_date: string | null;
    warranty_expiry_date: string | null;
    warranty_status: "No Warranty" | "Active" | "Expired";
  } | null;
}

export interface JobFilterParams {
  searchQuery?: string;
  status?: string;
  technician?: string;
  deviceType?: string;
  dateRange?: { from: string; to: string };
}

export function useServiceJobs(filters: JobFilterParams = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const useJobsQuery = () => {
    return useQuery({
      queryKey: ["serviceJobs", filters],
      queryFn: async () => {
        const jobs = await localDB.jobs.getAll();
        const customers = await localDB.customers.getAll();
        const payments = await localDB.payments.getAll();
        const warranties = await localDB.warranties.getAll();

        // Join Data
        let enrichedJobs = jobs.map((job: any) => ({
          ...job,
          customers: customers.find((c: any) => c.id === job.customer_id) || null,
          payments: payments.find((p: any) => p.job_id === job.id) || null,
          warranties: warranties.find((w: any) => w.job_id === job.id) || null
        }));

        // Sort descending
        enrichedJobs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Apply strict logical constraints based on active filters
        if (filters.status && filters.status !== "ALL") {
          enrichedJobs = enrichedJobs.filter((job: any) => job.status === filters.status);
        }
        if (filters.technician && filters.technician !== "ALL") {
          enrichedJobs = enrichedJobs.filter((job: any) => job.technician_assigned === filters.technician);
        }
        if (filters.deviceType && filters.deviceType !== "ALL") {
          enrichedJobs = enrichedJobs.filter((job: any) => job.device_type === filters.deviceType);
        }
        if (filters.dateRange?.from && filters.dateRange?.to) {
          enrichedJobs = enrichedJobs.filter((job: any) => {
            const jobDate = job.created_at;
            return jobDate >= filters.dateRange!.from && jobDate <= filters.dateRange!.to;
          });
        }

        // Client-side text verification mapping for complex cross-column queries
        if (filters.searchQuery?.trim()) {
          const target = filters.searchQuery.toLowerCase().trim();
          enrichedJobs = enrichedJobs.filter(
            (job: any) =>
              job.bill_number?.toLowerCase().includes(target) ||
              job.customers?.name?.toLowerCase().includes(target) ||
              job.customers?.mobile_number?.includes(target) ||
              job.imei_serial_number?.toLowerCase().includes(target) ||
              job.model?.toLowerCase().includes(target)
          );
        }

        return enrichedJobs as ServiceJobPayload[];
      },
      staleTime: 1000 * 30, // 30 seconds fresh cache parameters
    });
  };

  const useNextBillNumber = () => {
    return useQuery({
      queryKey: ["nextBillNumber"],
      queryFn: async () => {
        const settings = await localDB.settings.get();
        const nextNum = settings.next_bill_number || 1;
        return nextNum.toString().padStart(5, '0');
      },
    });
  };

  const useSingleJobQuery = (id: string | undefined) => {
    return useQuery({
      queryKey: ["serviceJob", id],
      queryFn: async () => {
        if (!id) return null;
        
        const jobs = await localDB.jobs.getAll();
        const job = jobs.find((j: any) => j.id === id);
        if (!job) throw new Error("Job not found");

        const customers = await localDB.customers.getAll();
        const customer = customers.find((c: any) => c.id === job.customer_id) || null;
        
        const payments = await localDB.payments.getAll();
        const payment = payments.find((p: any) => p.job_id === job.id) || null;
        
        const warranties = await localDB.warranties.getAll();
        const warranty = warranties.find((w: any) => w.job_id === job.id) || null;

        return { ...job, customers: customer, payments: payment, warranties: warranty } as ServiceJobPayload;
      },
      enabled: !!id,
    });
  };

  const useCreateJobMutation = () => {
    return useMutation({
      mutationKey: ["createServiceJob"],
      mutationFn: async (values: ServiceJobFormValues) => {
        const customers = await localDB.customers.getAll();
        const jobs = await localDB.jobs.getAll();
        const payments = await localDB.payments.getAll();
        
        let customer = customers.find((c: any) => c.mobile_number === values.mobileNumber);
        
        if (!customer) {
          customer = {
            id: generateId(),
            name: values.customerName,
            mobile_number: values.mobileNumber,
            alternative_number: values.alternativeNumber || null,
            email: values.email || null,
            address: values.address || "Not Provided",
            gst_number: values.gstNumber || null,
            customer_notes: values.customerNotes || null,
          };
          customers.push(customer);
          await localDB.customers.save(customers);
        }

        const now = new Date().toISOString();
        const newJob = {
          id: generateId(),
          customer_id: customer.id,
          bill_number: values.billNumber,
          created_at: values.jobDate || now,
          updated_at: now,
          device_type: values.deviceType,
          brand: values.brand,
          model: values.model,
          imei_serial_number: values.imeiSerialNumber,
          device_password_pin: values.devicePasswordPin || null,
          accessories_received: values.accessoriesReceived,
          device_condition: values.deviceCondition,
          complaint: values.complaint,
          technician_assigned: values.technicianAssigned,
          estimated_delivery_date: values.estimatedDeliveryDate,
          status: values.status,
          billed_by: values.billedBy,
        };
        jobs.push(newJob);
        await localDB.jobs.save(jobs);

        const newPayment = {
          id: generateId(),
          job_id: newJob.id,
          estimated_amount: values.estimatedAmount,
          advance_paid: values.advancePaid,
          amount_collected: values.amountCollected,
          discount: values.discount,
          tax_percentage: values.taxPercentage,
          payment_method: values.paymentMethod,
        };
        payments.push(newPayment);
        await localDB.payments.save(payments);

        // Automatically update next bill number sequence to next consecutive number
        const billDigits = values.billNumber ? values.billNumber.match(/\d+$/) : null;
        const currentNum = billDigits ? parseInt(billDigits[0], 10) : 0;
        const settings = await localDB.settings.get();
        const nextNum = currentNum > 0 ? currentNum + 1 : ((settings.next_bill_number || 1) + 1);
        settings.next_bill_number = nextNum;
        await localDB.settings.save(settings);

        return newJob;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
        queryClient.invalidateQueries({ queryKey: ["nextBillNumber"] });
        toast({ title: "Ticket Registered", description: "Job ticket and ledger matrices created cleanly." });
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Execution Aborted", description: err.message });
      },
    });
  };

  const useUpdateFullJobMutation = () => {
    return useMutation({
      mutationKey: ["updateServiceJob"],
      mutationFn: async ({ id, values, customerId }: { id: string; values: ServiceJobFormValues; customerId: string }) => {
        const customers = await localDB.customers.getAll();
        const jobs = await localDB.jobs.getAll();
        const payments = await localDB.payments.getAll();

        const cIndex = customers.findIndex((c: any) => c.id === customerId);
        if (cIndex > -1) {
          customers[cIndex] = {
            ...customers[cIndex],
            name: values.customerName,
            mobile_number: values.mobileNumber,
            alternative_number: values.alternativeNumber || null,
            email: values.email || null,
            address: values.address || "Not Provided",
            gst_number: values.gstNumber || null,
            customer_notes: values.customerNotes || null,
          };
          await localDB.customers.save(customers);
        }

        const jIndex = jobs.findIndex((j: any) => j.id === id);
        if (jIndex > -1) {
          jobs[jIndex] = {
            ...jobs[jIndex],
            bill_number: values.billNumber,
            updated_at: new Date().toISOString(),
            device_type: values.deviceType,
            brand: values.brand,
            model: values.model,
            imei_serial_number: values.imeiSerialNumber,
            device_password_pin: values.devicePasswordPin || null,
            accessories_received: values.accessoriesReceived,
            device_condition: values.deviceCondition,
            complaint: values.complaint,
            technician_assigned: values.technicianAssigned,
            estimated_delivery_date: values.estimatedDeliveryDate,
            status: values.status,
            billed_by: values.billedBy,
          };
          await localDB.jobs.save(jobs);
        }

        const pIndex = payments.findIndex((p: any) => p.job_id === id);
        if (pIndex > -1) {
          payments[pIndex] = {
            ...payments[pIndex],
            estimated_amount: values.estimatedAmount,
            advance_paid: values.advancePaid,
            amount_collected: values.amountCollected,
            discount: values.discount,
            tax_percentage: values.taxPercentage,
            payment_method: values.paymentMethod,
          };
          await localDB.payments.save(payments);
        }

        // If updated bill number sequence is higher, advance settings.next_bill_number
        if (values.billNumber) {
          const match = values.billNumber.match(/\d+$/);
          if (match) {
            const currentNum = parseInt(match[0], 10);
            const settings = await localDB.settings.get();
            if (currentNum >= (settings.next_bill_number || 1)) {
              settings.next_bill_number = currentNum + 1;
              await localDB.settings.save(settings);
              queryClient.invalidateQueries({ queryKey: ["nextBillNumber"] });
            }
          }
        }
        
        return id;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
        queryClient.invalidateQueries({ queryKey: ["serviceJob", variables.id] });
        queryClient.invalidateQueries({ queryKey: ["dashboardMetricsMaster"] });
        toast({ title: "Ticket Updated", description: "Job ticket and ledger matrices updated cleanly." });
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Update Aborted", description: err.message });
      },
    });
  };

  const useUpdateJobStatusMutation = () => {
    return useMutation({
      mutationFn: async ({ id, status, remarks }: { id: string; status: string; remarks?: string }) => {
        const jobs = await localDB.jobs.getAll();
        const jIndex = jobs.findIndex((j: any) => j.id === id);
        if (jIndex > -1) {
          jobs[jIndex].status = status;
          jobs[jIndex].updated_at = new Date().toISOString();
          if (remarks) jobs[jIndex].delivery_remarks = remarks;
          await localDB.jobs.save(jobs);
        }
        return jobs[jIndex];
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
        queryClient.invalidateQueries({ queryKey: ["serviceJob", variables.id] });
        queryClient.invalidateQueries({ queryKey: ["dashboardMetricsMaster"] });
        queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
        toast({ title: "Pipeline Mutated", description: `Ticket transition state updated to: ${variables.status}` });
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Mutation Refused", description: err.message });
      },
    });
  };

  const useDeleteJobMutation = () => {
    return useMutation({
      mutationKey: ["deleteServiceJob"],
      mutationFn: async (jobId: string) => {
        // Cascade delete payments and warranties associated with this job
        const payments = await localDB.payments.getAll();
        const paymentsToDelete = payments.filter((p: any) => p.job_id === jobId);
        for (const p of paymentsToDelete) {
          try {
            await localDB.payments.delete(p.id);
          } catch (e) {
            console.warn("Failed to delete linked payment", e);
          }
        }

        const warranties = await localDB.warranties.getAll();
        const warrantiesToDelete = warranties.filter((w: any) => w.job_id === jobId);
        for (const w of warrantiesToDelete) {
          try {
            await localDB.warranties.delete(w.id);
          } catch (e) {
            console.warn("Failed to delete linked warranty", e);
          }
        }

        // Delete job record
        await localDB.jobs.delete(jobId);
        return jobId;
      },
      onSuccess: (_, deletedId) => {
        queryClient.invalidateQueries({ queryKey: ["serviceJobs"] });
        queryClient.invalidateQueries({ queryKey: ["serviceJob", deletedId] });
        queryClient.invalidateQueries({ queryKey: ["reportsLedgerMaster"] });
        queryClient.invalidateQueries({ queryKey: ["dashboardMetricsMaster"] });
        queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
        queryClient.invalidateQueries({ queryKey: ["pendingDeliveryFeed"] });
        toast({ title: "Ticket Deleted", description: "The service ticket and associated records have been removed." });
      },
      onError: (err: Error) => {
        toast({ variant: "destructive", title: "Deletion Failed", description: err.message });
      },
    });
  };

  return {
    useJobsQuery,
    useNextBillNumber,
    useSingleJobQuery,
    useCreateJobMutation,
    useUpdateFullJobMutation,
    useUpdateJobStatusMutation,
    useDeleteJobMutation,
  };
}