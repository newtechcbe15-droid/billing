import React, { useEffect, useState } from 'react';
import './Invoice.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useParams, useNavigate } from 'react-router-dom';
import { generateId } from '@/lib/localDB';
import { localInvoiceDB } from '@/lib/invoiceDB';
import { numberToWords } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [details, setDetails] = useState({
    id: '',
    name: '',
    role: '',
    invoiceNo: '',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    gstPercent: 10,
  });

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadInvoiceData();
  }, [id]);

  const loadInvoiceData = async () => {
    setLoading(true);
    try {
      if (id === 'new') {
        // Fetch next invoice number from local DB
        const nextNo = await localInvoiceDB.getNextInvoiceNumber();
        setDetails((prev) => ({
          ...prev,
          id: generateId(),
          invoiceNo: String(nextNo).padStart(6, '0'),
        }));
        setItems([
          { id: Date.now(), name: '', desc: '', qty: 1, unit: 0 }
        ]);
      } else if (id) {
        // Fetch existing invoice from local DB
        const inv = await localInvoiceDB.getById(id);
        if (inv) {
          setDetails({
            id: inv.id,
            name: inv.client_name,
            role: inv.role || '',
            invoiceNo: inv.invoice_no,
            date: inv.date,
            gstPercent: inv.gst_percent || 0,
          });
          setItems(inv.items || []);
        } else {
          toast({ title: 'Error', description: 'Invoice not found', variant: 'destructive' });
          navigate('/invoice');
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: details.id,
        invoice_no: details.invoiceNo,
        client_name: details.name,
        role: details.role,
        date: details.date,
        gst_percent: details.gstPercent,
        items: items
      };

      await localInvoiceDB.save(payload);

      // If new, increment next invoice number in local DB
      if (id === 'new') {
        await localInvoiceDB.incrementInvoiceNumber();
      }

      toast({ title: 'Success', description: 'Invoice saved locally!' });
      if (id === 'new') {
        navigate(`/invoice/${details.id}`, { replace: true });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to save invoice', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const element = document.querySelector('.sheet') as HTMLElement;
    if (!element) return;

    try {
      setDownloading(true);
      toast({
        title: "Generating Invoice PDF...",
        description: "Preparing your high-resolution A4 document.",
      });

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297), undefined, 'FAST');
      pdf.save(`Invoice_${details.invoiceNo || 'Draft'}.pdf`);

      toast({
        title: "Invoice Downloaded!",
        description: `Successfully saved as Invoice_${details.invoiceNo || 'Draft'}.pdf`,
      });
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Download Failed",
        description: "Could not generate PDF. You can try the Print button instead.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails({ ...details, [e.target.name]: Number(e.target.value) });
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const subTotal = items.reduce((acc, item) => acc + (item.qty * item.unit), 0);
  const gstAmount = subTotal * ((details.gstPercent || 0) / 100);
  const grandTotal = subTotal + gstAmount;

  return (
    <div className="invoice-layout">
      {/* Input Form Column */}
      <div className="invoice-sidebar print-hidden">
        <Card className="w-full bg-white/50 backdrop-blur border-white/40 shadow-sm dark:bg-zinc-950/50 dark:border-zinc-800/50 max-h-[90vh] overflow-y-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Client Name</label>
              <Input name="name" value={details.name} onChange={handleChange} placeholder="e.g. John Doe" className="h-8 text-sm bg-white/70 dark:bg-zinc-900/70" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Role / Company / Address</label>
              <textarea
                name="role"
                value={details.role}
                onChange={(e) => setDetails({ ...details, role: e.target.value })}
                placeholder="e.g. Manager, ACME Corp&#10;123 Street Name"
                className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/70 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
              />
            </div>
            <div className="flex gap-2">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Inv Number</label>
                <Input name="invoiceNo" value={details.invoiceNo} onChange={handleChange} placeholder="e.g. 123456" className="h-8 text-sm bg-white/70 dark:bg-zinc-900/70" />
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Date</label>
                <Input name="date" value={details.date} onChange={handleChange} placeholder="e.g. 20 Nov, 2023" className="h-8 text-sm bg-white/70 dark:bg-zinc-900/70" />
              </div>
            </div>

            {/* ITEMS LIST */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Line Items</label>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setItems([...items, { id: Date.now(), name: '', desc: '', qty: 1, unit: 0 }])}>
                  + Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={item.id} className="p-2 border rounded-md border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Item {index + 1}</span>
                      <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-rose-500 hover:text-rose-700 text-xs font-bold leading-none">&times;</button>
                    </div>
                    <Input value={item.name} onChange={(e) => {
                      const newItems = [...items]; newItems[index].name = e.target.value; setItems(newItems);
                    }} placeholder="Item Name" className="h-7 text-xs bg-white dark:bg-zinc-950" />
                    <Input value={item.desc} onChange={(e) => {
                      const newItems = [...items]; newItems[index].desc = e.target.value; setItems(newItems);
                    }} placeholder="Description" className="h-7 text-xs bg-white dark:bg-zinc-950" />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground block mb-0.5">Qty</label>
                        <Input type="number" value={item.qty} onChange={(e) => {
                          const newItems = [...items]; newItems[index].qty = Number(e.target.value); setItems(newItems);
                        }} placeholder="Qty" className="h-7 text-xs bg-white dark:bg-zinc-950" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground block mb-0.5">Unit Price</label>
                        <Input type="number" value={item.unit} onChange={(e) => {
                          const newItems = [...items]; newItems[index].unit = Number(e.target.value); setItems(newItems);
                        }} placeholder="Price" className="h-7 text-xs bg-white dark:bg-zinc-950" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">GST % (Optional)</label>
                <Input type="number" name="gstPercent" value={details.gstPercent} onChange={handleNumberChange} className="h-7 text-xs bg-white/70 dark:bg-zinc-900/70" />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || downloading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Invoice
              </Button>
              <Button onClick={handleDownload} disabled={downloading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md gap-2">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? "Generating PDF..." : "Download Invoice"}
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="w-full border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-400 gap-2 font-semibold">
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="invoice-container">
        <div className="sheet">

          <div className="header">
            <svg className="header-svg" viewBox="0 0 1000 150" preserveAspectRatio="none" aria-hidden={true}>
              <defs>
                <linearGradient id="darkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2c2c2c" />
                  <stop offset="100%" stopColor="#181818" />
                </linearGradient>
                <linearGradient id="greenGrad" x1="0%" y1="0%" x2="60%" y2="100%">
                  <stop offset="0%" stopColor="#8FDFA9" />
                  <stop offset="100%" stopColor="#2FA855" />
                </linearGradient>
              </defs>
              <polygon points="710,0 1000,0 1000,150 560,150" fill="url(#darkGrad)" />
              <polygon points="660,0 695,0 510,150 545,150" fill="url(#greenGrad)" />
              <rect x="690" y="15" width="7" height="7" fill="#8FDFA9" opacity=".95" />
              <rect x="650" y="45" width="4.5" height="4.5" fill="#ffffff" opacity=".55" />
              <rect x="610" y="75" width="7" height="7" fill="#2FA855" opacity=".85" />
              <rect x="570" y="105" width="4.5" height="4.5" fill="#ffffff" opacity=".4" />
              <rect x="530" y="135" width="6" height="6" fill="#8FDFA9" opacity=".8" />
              <text x="815" y="85" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontFamily="'Space Grotesk', sans-serif" fontSize="42" fontWeight="700" letterSpacing="4">INVOICE</text>
            </svg>
            <div className="brand">
              <img src="/logo.png" alt="New Technology Logo" style={{ maxHeight: '86px', objectFit: 'contain' }} />
            </div>
          </div>
          <div className="green-bar"></div>

          <div className="body-pad">
            <div className="top-info">
              <div className="invoice-to fx fx1">
                <div className="eyebrow-label">Invoice To</div>
                <div className="name">{details.name || "Client Name"}</div>
                <div className="role">{details.role || "Role, Company"}</div>
              </div>
              <div className="invoice-meta fx fx1">
                <div className="invoice-no">
                  <span className="dot"></span>
                  <span>INVOICE NO: #{details.invoiceNo || "000000"}</span>
                  <span style={{ width: '6px', height: '6px', visibility: 'hidden' }}></span>
                </div>
                <table>
                  <tbody>
                    <tr><td className="k">Invoice Date</td><td>{details.date || "Date"}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <table className="items fx fx2">
              <thead>
                <tr>
                  <th>Item description</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Price</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted-foreground py-8">No items added</td>
                  </tr>
                ) : items.map((item, index) => (
                  <tr key={item.id} className="fx" style={{ animationDelay: `${0.5 + index * 0.08}s` }}>
                    <td>
                      <div className="item-name">{item.name || 'Item Name'}</div>
                      <div className="item-desc">{item.desc || 'Item Description'}</div>
                    </td>
                    <td className="qty">{String(item.qty).padStart(2, '0')}</td>
                    <td className="unit">₹ {item.unit.toFixed(2)}</td>
                    <td className="total">₹ {(item.qty * item.unit).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="lower">
              <div className="payment fx fx3">
                <div className="eyebrow-label">BANK DETAILS</div>
                <table>
                  <tbody>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>NAME</td><td>NEW TECHNOLOGY</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>BANK</td><td>BANK OF BARODA</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>ACC NO.</td><td>75130200000243</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>IFSC CODE</td><td>BARB0VJVAPU</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>BRANCH</td><td>VARATHARAJAPURAM, COIMBATORE</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>PAN</td><td>EIHPS6486M</td></tr>
                    <tr><td className="k" style={{ paddingRight: '16px' }}>GSTIN/UIN</td><td>33EIHPS6486M2ZC</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="totals fx fx3">
                <div className="row"><span>Sub Total</span><span>₹{subTotal.toFixed(2)}</span></div>
                {(details.gstPercent || 0) > 0 && (
                  <div className="row"><span>GST {details.gstPercent}%</span><span>₹{gstAmount.toFixed(2)}</span></div>
                )}
                <div className="grand-total"><span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="amount-in-words fx fx4">
              <span className="label">Amount in Words:</span> 
              <span className="words" style={{ textTransform: 'capitalize' }}>{numberToWords(Math.round(grandTotal))}</span>
            </div>


            <div className="sign fx fx5">
              <div className="sign-block">
                <div className="sig-role" style={{ color: 'var(--ink)', fontSize: '16px', fontWeight: '900', marginBottom: '60px', textAlign: 'center' }}>For New Technology</div>
                <div className="sig-name" style={{ borderTop: 'none', paddingTop: 0 }}>Authorized Signatory</div>
              </div>
            </div>
          </div>

          <div className="contact-row fx fx6">
            <div className="item">
              <div className="circle dark">
                <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1L6.6 10.8z" /></svg>
              </div>
              <span>90802 55557</span>
            </div>
            <div className="item">
              <div className="circle green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              </div>
              <span>newtechcbe15@gmail.com</span>
            </div>
            <div className="item">
              <div className="circle dark">
                <svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" /></svg>
              </div>
              <span>613, Kamarajar Road, Near Singanallur Bus Stand, Singanallur, Coimbatore – 641 015.</span>
            </div>
          </div>

          <div className="footer-band">
            <div className="green-line"></div>
            <svg className="footer-svg" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden={true}>
              <defs>
                <linearGradient id="darkGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2c2c2c" />
                  <stop offset="100%" stopColor="#181818" />
                </linearGradient>
                <linearGradient id="greenGrad2" x1="100%" y1="0%" x2="40%" y2="100%">
                  <stop offset="0%" stopColor="#8FDFA9" />
                  <stop offset="100%" stopColor="#2FA855" />
                </linearGradient>
              </defs>
              <polygon points="0,0 400,0 720,60 0,60" fill="url(#darkGrad2)" />
              <polygon points="439,0 473,0 793,60 759,60" fill="url(#greenGrad2)" />
              <rect x="470" y="6" width="4" height="4" fill="#ffffff" opacity=".5" />
              <rect x="534" y="20" width="3" height="3" fill="#8FDFA9" opacity=".7" />
              <rect x="598" y="32" width="4" height="4" fill="#ffffff" opacity=".4" />
              <rect x="662" y="44" width="3" height="3" fill="#8FDFA9" opacity=".7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
