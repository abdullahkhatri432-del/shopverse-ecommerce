import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getStore } from '../lib/api';
import InvoiceView from '../components/InvoiceView';

export default function Invoice() {
  const { orderId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/orders/${orderId}/invoice`)
      .then((d) => setInvoice(d.invoice))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="container section invoice-page">
      {loading && <div className="page-loading">Loading invoice...</div>}
      {error && (
        <div className="empty-state">
          <p>{error}</p>
          <Link to="/account" className="btn btn-outline">
            Back to orders
          </Link>
        </div>
      )}
      {invoice && (
        <>
          <div className="invoice-actions no-print">
            <Link to="/account" className="btn btn-outline">
              ← Back to orders
            </Link>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          </div>
          <InvoiceView invoice={invoice} store={getStore()} />
        </>
      )}
    </div>
  );
}
