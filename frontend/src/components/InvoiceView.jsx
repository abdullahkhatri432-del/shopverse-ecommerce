import { getStore } from '../lib/api';

export function formatCents(cents) {
  const value = (cents ?? 0) / 100;
  return '₹' + value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lineTax(i) {
  if (i.cgst > 0) return `CGST ${i.rate}% ₹${(i.cgst / 100).toFixed(2)} + SGST ${i.rate}% ₹${(i.sgst / 100).toFixed(2)}`;
  if (i.igst > 0) return `IGST ${i.rate}% ₹${(i.igst / 100).toFixed(2)}`;
  return '—';
}

export default function InvoiceView({ invoice, store }) {
  const s = store || getStore();
  const t = invoice.totals;

  return (
    <div className="invoice">
      <div className="invoice-head">
        <div>
          <h2 className="invoice-title">TAX INVOICE</h2>
          <p className="invoice-no">Invoice No: {invoice.invoiceNumber}</p>
          <p className="invoice-date">Issued: {invoice.issuedAt}</p>
        </div>
        <div className="invoice-seller">
          <strong>{s.name}</strong>
          <span>{s.legalName}</span>
          <span>Proprietor: {s.proprietor}</span>
          <span>{s.address}</span>
          <span>
            {s.email} · {s.phone}
          </span>
          {s.gstin && <span>GSTIN: {s.gstin}</span>}
        </div>
      </div>

      <div className="invoice-buyer">
        <strong>Billed to</strong>
        <span>{invoice.buyer.name}</span>
        {invoice.buyer.companyName && <span>{invoice.buyer.companyName}</span>}
        <span>{invoice.buyer.address}</span>
        <span>
          {invoice.buyer.stateName} ({invoice.buyer.stateCode})
        </span>
        {invoice.buyer.gstin && <span>GSTIN: {invoice.buyer.gstin}</span>}
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Taxable Value</th>
            <th className="num">GST</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((i, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>
                {i.productName}
                <span className="invoice-cat">{i.category}</span>
              </td>
              <td className="num">{i.quantity}</td>
              <td className="num">{formatCents(i.priceCents)}</td>
              <td className="num">{formatCents(i.taxableCents)}</td>
              <td className="num">{lineTax(i)}</td>
              <td className="num">{formatCents(i.taxableCents + i.gst)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="4"></td>
            <th className="num">Subtotal</th>
            <td className="num"></td>
            <td className="num">{formatCents(t.subtotalCents)}</td>
          </tr>
          {t.cgst > 0 && (
            <tr>
              <td colSpan="4"></td>
              <th className="num">CGST</th>
              <td className="num"></td>
              <td className="num">{formatCents(t.cgst)}</td>
            </tr>
          )}
          {t.sgst > 0 && (
            <tr>
              <td colSpan="4"></td>
              <th className="num">SGST</th>
              <td className="num"></td>
              <td className="num">{formatCents(t.sgst)}</td>
            </tr>
          )}
          {t.igst > 0 && (
            <tr>
              <td colSpan="4"></td>
              <th className="num">IGST</th>
              <td className="num"></td>
              <td className="num">{formatCents(t.igst)}</td>
            </tr>
          )}
          <tr className="invoice-total">
            <td colSpan="4"></td>
            <th className="num">Total</th>
            <td className="num"></td>
            <td className="num">{formatCents(t.totalCents)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="invoice-foot">
        <p>
          {t.igst > 0
            ? 'Inter-state supply — IGST charged.'
            : 'Intra-state supply — CGST and SGST charged.'}{' '}
          Amount is inclusive of all taxes.
        </p>
        <p className="invoice-thanks">Thank you for shopping with {s.name}!</p>
      </div>
    </div>
  );
}
