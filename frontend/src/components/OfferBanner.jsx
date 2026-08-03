import { Link } from 'react-router-dom';
import { useCountdownToMidnight } from '../lib/hooks';

export default function OfferBanner() {
  const { hours, minutes, seconds } = useCountdownToMidnight();

  return (
    <section className="offer-banner" aria-label="Deals of the day">
      <div className="offer-inner">
        <div className="offer-copy">
          <span className="offer-tag">Deals of the day</span>
          <h2 className="offer-title">Save big on today's offers</h2>
          <p className="offer-sub">Hand-picked deals across every category, refreshed every day.</p>
          <Link to="/products?sort=price_desc" className="btn btn-light btn-lg">
            View all deals
          </Link>
        </div>
        <div className="offer-count" aria-label="Offer ends in">
          <span className="offer-count-label">Offer ends in</span>
          <div className="offer-clock">
            <div className="offer-unit">
              <strong>{hours}</strong>
              <span>hrs</span>
            </div>
            <span className="offer-colon">:</span>
            <div className="offer-unit">
              <strong>{minutes}</strong>
              <span>min</span>
            </div>
            <span className="offer-colon">:</span>
            <div className="offer-unit">
              <strong>{seconds}</strong>
              <span>sec</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
