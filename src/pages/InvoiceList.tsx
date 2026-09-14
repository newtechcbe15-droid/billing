import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { localInvoiceDB, Invoice } from '@/lib/invoiceDB';
import { Loader2, Plus, Edit, Trash2, FileText, Search, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await localInvoiceDB.getAll();
      setInvoices(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, invoiceNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete invoice #${invoiceNo}?`)) {
      try {
        await localInvoiceDB.delete(id);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        toast({ title: 'Deleted', description: `Invoice #${invoiceNo} removed from database.` });
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to delete invoice', variant: 'destructive' });
      }
    }
  };

  const getInvoiceTotal = (invoice: Invoice) => {
    const items = invoice.items || [];
    const subTotal = items.reduce((acc: number, item) => acc + (item.qty * item.unit), 0);
    const gstAmount = subTotal * ((invoice.gst_percent || 0) / 100);
    return subTotal + gstAmount;
  };

  const filteredInvoices = invoices.filter(inv => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      inv.invoice_no?.toLowerCase().includes(term) ||
      inv.client_name?.toLowerCase().includes(term) ||
      inv.date?.toLowerCase().includes(term)
    );
  });

  const grandTotal = invoices.reduce((acc, inv) => acc + getInvoiceTotal(inv), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              B2B & Standalone Invoices
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate printable GST invoices, track corporate clients, and manage billing items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate('/invoice/new')} 
            className="h-10 px-4 text-xs font-bold gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Create New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Invoices
            </span>
            <span className="text-2xl font-black font-mono text-foreground">{invoices.length}</span>
          </div>
          <FileText className="w-5 h-5 text-primary opacity-60" />
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Billed Volume
            </span>
            <span className="text-2xl font-black font-mono text-emerald-500">{formatCurrency(grandTotal)}</span>
          </div>
          <Database className="w-5 h-5 text-emerald-500 opacity-60" />
        </Card>

        <Card className="cockpit-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Storage Engine
            </span>
            <span className="text-xs font-bold text-foreground">Local DB + Supabase</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
            Active
          </Badge>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="cockpit-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Invoice Directory ({filteredInvoices.length} Records)
          </span>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search invoice # or client..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-background"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/80 hover:bg-transparent">
                <TableHead className="text-xs font-bold uppercase py-3.5">Invoice #</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Client / Corporate Name</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5">Issue Date</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5 text-right">Gross Total</TableHead>
                <TableHead className="text-xs font-bold uppercase py-3.5 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                    No invoices found. Click "Create New Invoice" to issue one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                    <TableCell className="font-mono font-bold text-foreground">
                      #{inv.invoice_no}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {inv.client_name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {inv.date}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(getInvoiceTotal(inv))}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/invoice/${inv.id}`)}
                          title="View / Edit Invoice"
                          className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                        >
                          <Edit className="w-3.5 h-3.5 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(inv.id, inv.invoice_no, e)}
                          title="Delete Invoice"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
