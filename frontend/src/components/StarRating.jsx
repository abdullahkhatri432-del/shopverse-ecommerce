export default function StarRating({ value = 0, onChange, size = 'md' }) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span
        className={`star-rating star-rating-${size}`}
        role="img"
        aria-label={`Rated ${value} out of 5 stars`}
      >
        {stars.map((s) => (
          <span key={s} className={`star ${s <= Math.round(value) ? 'filled' : ''}`} aria-hidden="true">
            ★
          </span>
        ))}
        <span className="star-value">{value > 0 ? value.toFixed(1) : ''}</span>
      </span>
    );
  }

  return (
    <div className={`star-rating star-rating-${size} star-rating-input`} role="radiogroup" aria-label="Rate this product">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s <= value}
          aria-label={`${s} star${s === 1 ? '' : 's'}`}
          className={`star ${s <= value ? 'filled' : ''}`}
          onClick={() => onChange(s)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
