import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { localInvoiceDB, Invoice } from '@/lib/invoiceDB';
import { Loader2, Plus, Edit, Trash2, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
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
        toast({ title: 'Deleted', description: `Invoice #${invoiceNo} removed from local database.` });
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Database className="w-3 h-3" /> Local Storage
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and view your locally stored invoices.</p>
        </div>
        <Button onClick={() => navigate('/invoice/new')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <Plus className="w-4 h-4" /> Create New Invoice
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No invoices found in local database. Create one to get started!
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">#{inv.invoice_no}</TableCell>
                    <TableCell>{inv.client_name}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell className="text-right font-medium">₹{getInvoiceTotal(inv).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/invoice/${inv.id}`)}
                          title="View / Edit"
                          className="hover:text-blue-600"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(inv.id, inv.invoice_no, e)}
                          title="Delete"
                          className="hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
