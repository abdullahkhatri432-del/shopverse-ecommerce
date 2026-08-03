import { Link } from 'react-router-dom';
import { getStore, getGrievanceOfficer } from '../lib/api';

function Section({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }) {
  return (
    <div className="legal-subsection">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Bullets({ items }) {
  return (
    <ul>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function LegalContent({ slug }) {
  const store = getStore();
  const officer = getGrievanceOfficer();
  const lastUpdated = 'August 2026';

  const commonIntro = (
    <>
      <p>
        This document belongs to <strong>{store.legalName || store.name}</strong>, a sole
        proprietorship owned and operated by <strong>{store.proprietor}</strong>.
      </p>
      <p>
        Registered address:{' '}
        <strong>
          {store.address || 'Your Registered Address, City, State, PIN'}
        </strong>
      </p>
      <p>
        Contact: {store.email || 'support@yourstore.com'} ·{' '}
        {store.phone || '+91 90000 00000'} · {store.website || 'www.yourstore.com'}
      </p>
      {store.gstin ? (
        <p>GSTIN: <strong>{store.gstin}</strong></p>
      ) : (
        <p className="legal-note">
          GST registration is in progress; the GSTIN will be published here once available.
        </p>
      )}
    </>
  );

  if (slug === 'terms') {
    return (
      <>
        {commonIntro}
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or purchasing from {store.name}, you agree to these Terms of Service. If you
            do not agree, please do not use the website.
          </p>
        </Section>
        <Section title="2. Products & Pricing">
          <p>
            Product images are indicative. All prices are in Indian Rupees (₹) inclusive of GST.
            While we try to keep product details accurate, we do not warrant that descriptions,
            colours, or availability are error-free, and we may correct errors without notice.
          </p>
        </Section>
        <Section title="3. Orders & Acceptance">
          <p>
            An order is placed when you complete checkout. A confirmation email marks our acceptance.
            We may cancel an order before dispatch if the product is unavailable or the price is
            incorrect, in which case you will receive a full refund.
          </p>
        </Section>
        <Section title="4. Payments">
          <p>
            Payments are processed securely through the Razorpay payment gateway. You agree to pay
            the amount shown at checkout. Refunds, if any, are processed back to the original payment
            method.
          </p>
        </Section>
        <Section title="5. Ownership & Use">
          <p>
            Content on this website (text, images, logos) belongs to {store.name} and may not be
            reproduced without written permission.
          </p>
        </Section>
        <Section title="6. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, {store.name} is not liable for indirect or
            consequential losses arising from use of the website or products purchased.
          </p>
        </Section>
        <Section title="7. Governing Law">
          <p>
            These terms are governed by the laws of India and subject to the exclusive jurisdiction
            of the courts at {store.address?.split(',').pop()?.trim() || 'your city'}.
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'privacy') {
    return (
      <>
        {commonIntro}
        <Section title="1. Information We Collect">
          <Subsection title="A. Information you provide">
            <Bullets
              items={[
                'Name, email address, and contact details at registration or checkout.',
                'Billing details such as company name, GSTIN, and billing state (optional).',
                'Shipping address for order delivery.',
              ]}
            />
          </Subsection>
          <Subsection title="B. Information collected automatically">
            <Bullets
              items={[
                'Browser/device details and pages visited (via analytics, only if you consent).',
                'Cookies and local storage — see section 3.',
              ]}
            />
          </Subsection>
          <Subsection title="C. Payment information">
            <p>
              We do not store your card details. Payments are processed by Razorpay, whose privacy
              policy governs how it handles your payment data.
            </p>
          </Subsection>
        </Section>
        <Section title="2. How We Use Your Information">
          <Bullets
            items={[
              'To process orders, payments, and deliver products.',
              'To send order updates, invoices, and receipts.',
              'To provide customer support and resolve disputes.',
              'To improve our website (only with your consent).',
            ]}
          />
        </Section>
        <Section title="3. Cookies & Local Storage">
          <p>
            We use essential cookies/local storage to keep your cart and login session working, and
            the Razorpay payment gateway uses cookies to process payments. Non-essential tracking is
            only enabled if you accept all cookies via our consent banner. You can withdraw consent
            at any time by clearing your browser storage.
          </p>
        </Section>
        <Section title="4. Data Sharing">
          <p>
            We share data only with service providers needed to run the store — the payment gateway
            (Razorpay), delivery partners, and hosting — and only to the extent necessary. We do not
            sell your personal data.
          </p>
        </Section>
        <Section title="5. Data Security & Retention">
          <p>
            Your data is stored securely with password hashing and industry-standard protections. We
            retain order records for tax and accounting purposes as required by law.
          </p>
        </Section>
        <Section title="6. Your Rights (DPDP Act 2023)">
          <p>
            Under India's Digital Personal Data Protection Act, 2023, you have the right to access,
            correct, and delete your personal data, and to withdraw consent. Email us at{' '}
            {store.email || 'support@yourstore.com'} to exercise these rights.
          </p>
        </Section>
        <Section title="7. Grievance Redressal">
          <p>
            If you have a concern about your personal data, you may contact our Grievance Officer:
          </p>
          <p>
            <strong>{officer.name || 'Your Name'}</strong>
            <br />
            Email: {officer.email || 'grievance@yourstore.com'}
            <br />
            Phone: {officer.phone || '+91 90000 00000'}
          </p>
          <p>
            We will acknowledge your complaint within 48 hours and resolve it within one month.
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'refunds') {
    return (
      <>
        {commonIntro}
        <Section title="1. Returns Window">
          <p>
            You may raise a return request within <strong>7 days</strong> of delivery for most
            products (or 24 hours for categories like intimate wear, as displayed on the product).
          </p>
        </Section>
        <Section title="2. Conditions for Return">
          <Bullets
            items={[
              'Product is unused, unwashed, and in original packaging.',
              'Return request is raised through our grievance/return channel within the window.',
              'The product shows a manufacturing defect, is damaged in transit, or is a wrong item.',
            ]}
          />
        </Section>
        <Section title="3. Non-returnable Items">
          <Bullets
            items={['Personalised or custom-made products.', 'Intimate/grooming products once opened.', 'Perishable items and sealed health products whose seal is broken.']}
          />
        </Section>
        <Section title="4. Refund Timeline">
          <p>
            Once the returned item is verified at our facility, a refund is initiated within{' '}
            <strong>5–7 business days</strong> to the original payment method. The refund may take a
            few additional days to reflect depending on your bank.
          </p>
        </Section>
        <Section title="5. Replacement">
          <p>
            For defective or damaged items you may choose a free replacement subject to stock
            availability.
          </p>
        </Section>
        <Section title="6. How to Raise a Return">
          <p>
            Email {store.email || 'support@yourstore.com'} with your order number and a photo of the
            item. Our team will respond within 48 hours.
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'shipping') {
    return (
      <>
        {commonIntro}
        <Section title="1. Delivery Locations">
          <p>We currently ship to all pincodes across India.</p>
        </Section>
        <Section title="2. Delivery Timeframes">
          <Bullets
            items={[
              'Metro cities: 2–5 business days.',
              'Other cities and towns: 4–8 business days.',
              'Order processing time of 1–2 business days before dispatch.',
            ]}
          />
        </Section>
        <Section title="3. Shipping Charges">
          <p>
            Shipping charges are calculated at checkout and shown before you pay. No hidden
            charges are added later.
          </p>
        </Section>
        <Section title="4. Tracking">
          <p>
            Once dispatched, you will receive a tracking link on your email/phone if the courier
            partner provides one.
          </p>
        </Section>
        <Section title="5. Delayed / Lost Shipments">
          <p>
            If a shipment is delayed beyond the stated timeframe or lost in transit, contact us at{' '}
            {store.email || 'support@yourstore.com'} and we will re-ship or refund.
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'cancellation') {
    return (
      <>
        {commonIntro}
        <Section title="1. Order Cancellation">
          <p>
            You can cancel an order <strong>before it is dispatched</strong> by emailing{' '}
            {store.email || 'support@yourstore.com'} with your order number. Once dispatched,
            cancellation is treated as a return and follows the Return Policy.
          </p>
        </Section>
        <Section title="2. Cancellation by Us">
          <p>
            We reserve the right to cancel an order if the product is out of stock or a pricing
            error occurred. In such cases a full refund is issued within 5–7 business days.
          </p>
        </Section>
        <Section title="3. Refund on Cancellation">
          <p>
            Cancelled and fully-refunded orders are processed to the original payment method within
            5–7 business days.
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'grievance') {
    return (
      <>
        <p>
          In compliance with the Consumer Protection (E-Commerce) Rules, 2020 and the IT Rules,
          2021, we have designated a Grievance Officer for customer and data-related complaints.
        </p>
        <Section title="Grievance Officer">
          <p>
            <strong>{officer.name || 'Your Name'}</strong>
            <br />
            Designation: Grievance Officer, {store.name}
            <br />
            Email: {officer.email || 'grievance@yourstore.com'}
            <br />
            Phone: {officer.phone || '+91 90000 00000'}
            <br />
            Address: {store.address || 'Your Registered Address, City, State, PIN'}
          </p>
        </Section>
        <Section title="How to File a Complaint">
          <ol>
            <li>Email the Grievance Officer with your order number and issue description.</li>
            <li>You will receive an acknowledgement within 48 hours.</li>
            <li>We aim to resolve complaints within one month of receipt.</li>
            <li>
              If you are not satisfied, you may escalate to the relevant consumer dispute redressal
              commission as per the Consumer Protection Act, 2019.
            </li>
          </ol>
        </Section>
        <Section title="National Consumer Helpline">
          <p>
            You may also reach the National Consumer Helpline (NCH) at{' '}
            <strong>1915</strong> or via{' '}
            <a href="https://consumerhelpline.gov.in" target="_blank" rel="noreferrer">
              consumerhelpline.gov.in
            </a>
            .
          </p>
        </Section>
      </>
    );
  }

  if (slug === 'seller') {
    return (
      <>
        <p>
          Details of the seller as required under Rule 4(1) of the Consumer Protection
          (E-Commerce) Rules, 2020:
        </p>
        <Section title="Seller Information">
          <p>
            <strong>Business name:</strong> {store.legalName || store.name}
            <br />
            <strong>Legal entity:</strong> Sole Proprietorship (registration details to be
            published once complete)
            <br />
            <strong>Proprietor:</strong> {store.proprietor}
            <br />
            <strong>Registered address:</strong> {store.address || 'Your Registered Address, City, State, PIN'}
            <br />
            <strong>Contact:</strong> {store.email || 'support@yourstore.com'} · {store.phone || '+91 90000 00000'}
            <br />
            <strong>Website:</strong> {store.website || 'www.yourstore.com'}
          </p>
        </Section>
        <Section title="Tax Registration">
          <p>
            {store.gstin ? (
              <>
                <strong>GSTIN:</strong> {store.gstin}
                <br />
                <strong>State of registration:</strong> {store.stateName || store.stateCode || 'Delhi'}
              </>
            ) : (
              <span className="legal-note">
                GST registration is in progress. The GSTIN and other registration details will be
                published here once obtained.
              </span>
            )}
          </p>
        </Section>
        <Section title="Compliance">
          <Bullets
            items={[
              'Prices are inclusive of GST and no additional taxes are charged at delivery.',
              'Clear refund, return, shipping, and cancellation policies are published on this website.',
              'A Grievance Officer is designated for customer complaints — see the Grievance page.',
            ]}
          />
        </Section>
      </>
    );
  }

  return <p>This page could not be found.</p>;
}

const TITLES = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refunds: 'Refund & Return Policy',
  shipping: 'Shipping Policy',
  cancellation: 'Cancellation Policy',
  grievance: 'Grievance Officer',
  seller: 'Seller Information',
};

export default function Legal({ slug }) {
  return (
    <div className="container section legal-page">
      <Link to="/" className="legal-back">
        ← Back to store
      </Link>
      <h1 className="page-title">{TITLES[slug] || 'Legal'}</h1>
      <p className="legal-updated">Last updated: August 2026</p>
      <LegalContent slug={slug} />
    </div>
  );
}
