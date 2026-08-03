const STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STEP_INDEX = {
  pending: 0,
  paid: 0,
  packed: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

export default function OrderTracking({ status }) {
  if (status === 'cancelled') {
    return <p className="notice notice-warning">This order was cancelled.</p>;
  }
  if (['return_requested', 'return_approved', 'returned'].includes(status)) {
    const label = {
      return_requested: 'Return requested — our team is reviewing it',
      return_approved: 'Return approved — please ship the item back',
      returned: 'Return completed — refund initiated',
    }[status];
    return <p className="notice notice-info">Return: {label}</p>;
  }

  const active = STEP_INDEX[status] ?? 0;
  return (
    <ol className="tracking-steps">
      {STEPS.map((step, i) => {
        const done = i < active || status === 'delivered';
        const current = i === active && status !== 'delivered';
        return (
          <li key={step.key} className={`tracking-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <span className="tracking-dot">{done ? '✓' : i + 1}</span>
            <span className="tracking-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
