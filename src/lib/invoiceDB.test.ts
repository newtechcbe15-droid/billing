import { describe, it, expect, beforeEach } from 'vitest';
import { localInvoiceDB, Invoice } from './invoiceDB';

describe('localInvoiceDB', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize next invoice number as 1 when empty', async () => {
    const nextNo = await localInvoiceDB.getNextInvoiceNumber();
    expect(nextNo).toBe(1);
  });

  it('should save an invoice and retrieve it via getAll and getById', async () => {
    const invoice: Invoice = {
      id: 'inv-test-1',
      invoice_no: '000001',
      client_name: 'Test Client Ltd',
      role: 'IT Dept',
      date: '03 Sep, 2026',
      gst_percent: 18,
      items: [
        { id: 1, name: 'Server RAM 32GB', desc: 'DDR4 ECC', qty: 2, unit: 4500 }
      ]
    };

    await localInvoiceDB.save(invoice);

    const all = await localInvoiceDB.getAll();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('inv-test-1');
    expect(all[0].client_name).toBe('Test Client Ltd');
    expect(all[0].items.length).toBe(1);

    const fetched = await localInvoiceDB.getById('inv-test-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.invoice_no).toBe('000001');
  });

  it('should increment invoice sequence number properly', async () => {
    const first = await localInvoiceDB.getNextInvoiceNumber();
    expect(first).toBe(1);

    const incremented = await localInvoiceDB.incrementInvoiceNumber();
    expect(incremented).toBe(2);

    const next = await localInvoiceDB.getNextInvoiceNumber();
    expect(next).toBe(2);
  });

  it('should delete an invoice by id', async () => {
    const invoice: Invoice = {
      id: 'inv-test-delete',
      invoice_no: '000002',
      client_name: 'To Delete',
      date: '03 Sep, 2026',
      items: []
    };

    await localInvoiceDB.save(invoice);
    let all = await localInvoiceDB.getAll();
    expect(all.some(i => i.id === 'inv-test-delete')).toBe(true);

    await localInvoiceDB.delete('inv-test-delete');
    all = await localInvoiceDB.getAll();
    expect(all.some(i => i.id === 'inv-test-delete')).toBe(false);
  });
});
