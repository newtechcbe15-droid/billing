-- ==============================================================================
-- NTCS BILLING & SERVICE CENTRE ERP - SUPABASE SCHEMA DEFINITION & MIGRATION
-- ==============================================================================
-- Option A (Upgrading Existing DB): Copy SECTION 0 below and run in Supabase SQL Editor.
-- Option B (Fresh New Database): Copy the entire file and run in Supabase SQL Editor.
-- ==============================================================================

-- ==============================================================================
-- SECTION 0: IDEMPOTENT UPGRADE / MIGRATION SCRIPT (SAFE TO RUN ON EXISTING DB)
-- ==============================================================================
-- 1. Add missing columns to 'jobs' table
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS display_changed BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS storage_box TEXT;

-- 2. Add missing columns to 'salaries' table
ALTER TABLE IF EXISTS public.salaries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.salaries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- 3. Add missing columns to 'expenses' table
ALTER TABLE IF EXISTS public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- 4. Ensure 'attendance' table exists
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  staff_name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',
  check_in_time TEXT,
  check_out_time TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON public.attendance (staff_name);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissive access for attendance" ON public.attendance;
CREATE POLICY "Permissive access for attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- 5. Trigger updates
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_salaries_updated_at ON public.salaries;
CREATE TRIGGER trg_salaries_updated_at BEFORE UPDATE ON public.salaries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TRIGGER HELPER FOR AUTO-UPDATING 'updated_at' TIMESTAMPS
-- ==============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. TABLES DEFINITION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CUSTOMERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  alternative_number TEXT,
  email TEXT,
  address TEXT DEFAULT 'Not Provided',
  gst_number TEXT,
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for rapid customer phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers (mobile_number);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);

-- ------------------------------------------------------------------------------
-- JOBS TABLE (Core Service Ticket Pipeline)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
  bill_number TEXT,
  device_type TEXT NOT NULL,                -- 'Mobile', 'Laptop', 'PC'
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  imei_serial_number TEXT,
  device_password_pin TEXT,
  accessories_received JSONB DEFAULT '[]'::jsonb, -- e.g. ["Charger", "SIM"]
  device_condition TEXT,
  complaint TEXT NOT NULL,
  technician_assigned TEXT DEFAULT 'Suresh',
  estimated_delivery_date TEXT,
  status TEXT DEFAULT 'Collected',          -- 'Collected', 'Working', 'Ready', 'Return', 'Delivered', 'Delivered Return'
  billed_by TEXT DEFAULT 'Suresh',
  return_reason TEXT,
  return_reason_other TEXT,
  "returnReason" TEXT,                      -- Fallback alias for camelCase queries
  delivered_by TEXT,
  received_by TEXT,
  customer_signature TEXT,                  -- Base64 compressed image string
  delivery_remarks TEXT,
  spare_part_supplier TEXT,                 -- e.g. 'Kaveri', 'Surya', 'Bangalore', 'Cell Care'
  custom_warranty_days INTEGER DEFAULT 0,
  display_changed BOOLEAN DEFAULT false,    -- Tracks whether screen/display was replaced
  storage_box TEXT,                         -- Physical workshop storage box / bin ID
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for job queries and filters
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_bill_number ON public.jobs (bill_number);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON public.jobs (technician_assigned);

-- ------------------------------------------------------------------------------
-- PAYMENTS TABLE (Financial Ledger Associated with Jobs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  job_id TEXT REFERENCES public.jobs(id) ON DELETE CASCADE,
  estimated_amount NUMERIC(12, 2) DEFAULT 0,
  advance_paid NUMERIC(12, 2) DEFAULT 0,
  amount_collected NUMERIC(12, 2) DEFAULT 0,
  discount NUMERIC(12, 2) DEFAULT 0,
  tax_percentage NUMERIC(5, 2) DEFAULT 0,
  balance_due NUMERIC(12, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'Unpaid',      -- 'Paid', 'Partially Paid', 'Unpaid'
  payment_method TEXT DEFAULT 'Cash',        -- 'Cash', 'UPI', 'Card', 'Bank Transfer', 'Split', 'GPay'
  payment_date TEXT,
  split_cash NUMERIC(12, 2) DEFAULT 0,
  split_gpay NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payments (job_id);

-- ------------------------------------------------------------------------------
-- WARRANTIES TABLE (Post-Service Warranty SLA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warranties (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  job_id TEXT REFERENCES public.jobs(id) ON DELETE CASCADE,
  warranty_duration TEXT DEFAULT 'No Warranty',
  warranty_start_date TEXT,
  warranty_expiry_date TEXT,
  warranty_status TEXT DEFAULT 'No Warranty', -- 'No Warranty', 'Active', 'Expired'
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warranties_job_id ON public.warranties (job_id);
CREATE INDEX IF NOT EXISTS idx_warranties_expiry ON public.warranties (warranty_expiry_date);

-- ------------------------------------------------------------------------------
-- EXPENSES TABLE (Cash Flow Expenses and Inflow Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  type TEXT NOT NULL DEFAULT 'Expense',      -- 'Expense' or 'Revenue'
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',        -- 'Cash', 'GPay', 'Bank Transfer', 'Other'
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON public.expenses (type);

-- ------------------------------------------------------------------------------
-- SALARIES TABLE (Staff Payroll Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salaries (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  staff_name TEXT NOT NULL,                  -- 'Suresh', 'Sajith', 'Karthik Raj', etc.
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',        -- 'Cash', 'GPay', 'Bank Transfer'
  date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salaries_date ON public.salaries (date DESC);
CREATE INDEX IF NOT EXISTS idx_salaries_staff ON public.salaries (staff_name);

-- ------------------------------------------------------------------------------
-- STOCK TABLE (Spare Parts and Components Inventory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  item TEXT NOT NULL,                        -- 'Display', 'CC', 'Battery', etc.
  buyed_from TEXT,                           -- 'Kaveri', 'Surya', 'Bangalore', 'Cell Care'
  quantity INTEGER NOT NULL DEFAULT 0,
  supported_model TEXT,
  box_no TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_item ON public.stock (item);
CREATE INDEX IF NOT EXISTS idx_stock_supplier ON public.stock (buyed_from);

-- ------------------------------------------------------------------------------
-- ATTENDANCE TABLE (Staff Daily Attendance Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  staff_name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',    -- 'Present', 'Half Day', 'Absent', 'On Leave'
  check_in_time TEXT,
  check_out_time TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON public.attendance (staff_name);

-- ------------------------------------------------------------------------------
-- SETTINGS TABLE (Global System Sequence Counters & Shop Config)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  next_bill_number INTEGER DEFAULT 1,
  next_invoice_number INTEGER DEFAULT 1,
  company_name TEXT DEFAULT 'NEW TECHNOLOGY Mobile & Laptop Service Centre',
  phone TEXT DEFAULT '+91 98422 12345',
  email TEXT,
  address TEXT DEFAULT 'Singanallur, Coimbatore, Tamil Nadu',
  gst_number TEXT,
  terms_conditions TEXT,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed global settings if not existing
INSERT INTO public.settings (id, next_bill_number, next_invoice_number)
VALUES ('global', 1, 1)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- INVOICES TABLE (Standalone Invoices / B2B Bills)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  invoice_no TEXT NOT NULL,
  client_name TEXT NOT NULL,
  role TEXT,
  date TEXT NOT NULL,
  gst_percent NUMERIC(5, 2) DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,           -- [{"id": 1, "name": "Item", "desc": "", "qty": 1, "unit": 100}]
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_no ON public.invoices (invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices (client_name);

-- ------------------------------------------------------------------------------
-- COMPATIBILITY VIEW (service_jobs -> jobs)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.service_jobs AS
SELECT * FROM public.jobs;

-- ==============================================================================
-- 4. ATTACH AUTOMATIC TIMESTAMP TRIGGERS
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_warranties_updated_at ON public.warranties;
CREATE TRIGGER trg_warranties_updated_at BEFORE UPDATE ON public.warranties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_salaries_updated_at ON public.salaries;
CREATE TRIGGER trg_salaries_updated_at BEFORE UPDATE ON public.salaries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_stock_updated_at ON public.stock;
CREATE TRIGGER trg_stock_updated_at BEFORE UPDATE ON public.stock
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enable RLS across all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for authenticated & anon clients
-- (allowing the React web app frontend to read, insert, update, and delete)
DROP POLICY IF EXISTS "Permissive access for customers" ON public.customers;
CREATE POLICY "Permissive access for customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for jobs" ON public.jobs;
CREATE POLICY "Permissive access for jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for payments" ON public.payments;
CREATE POLICY "Permissive access for payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for warranties" ON public.warranties;
CREATE POLICY "Permissive access for warranties" ON public.warranties FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for expenses" ON public.expenses;
CREATE POLICY "Permissive access for expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for salaries" ON public.salaries;
CREATE POLICY "Permissive access for salaries" ON public.salaries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for stock" ON public.stock;
CREATE POLICY "Permissive access for stock" ON public.stock FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for attendance" ON public.attendance;
CREATE POLICY "Permissive access for attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for settings" ON public.settings;
CREATE POLICY "Permissive access for settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissive access for invoices" ON public.invoices;
CREATE POLICY "Permissive access for invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 6. REALTIME REPLICATION (Allows instant live updates across devices)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.customers,
      public.jobs,
      public.payments,
      public.warranties,
      public.expenses,
      public.salaries,
      public.stock,
      public.attendance,
      public.settings,
      public.invoices;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if tables are already in the publication or permission is restricted
    NULL;
END $$;
