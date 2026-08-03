const express = require('express');
const { promoList } = require('../promos');

const router = express.Router();

const razorpayEnabled = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

router.get('/', (req, res) => {
  res.json({
    paymentProvider: razorpayEnabled() ? 'razorpay' : 'mock',
    paymentMode: process.env.PAYMENT_MODE || (razorpayEnabled() ? 'test' : 'mock'),
    currency: process.env.CURRENCY || 'INR',
    razorpayEnabled: razorpayEnabled(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    codEnabled: process.env.COD_ENABLED !== 'false',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    promos: promoList(),
    freeShippingThresholdCents: 99900,
    store: {
      name: process.env.STORE_NAME || 'ShopVerse',
      legalName: process.env.STORE_LEGAL_NAME || 'Your Legal Business Name',
      proprietor: process.env.STORE_PROPRIETOR || 'Your Full Name',
      address: process.env.STORE_ADDRESS || 'Your Registered Address, City, State, PIN',
      email: process.env.STORE_EMAIL || 'support@yourstore.com',
      phone: process.env.STORE_PHONE || '+91 90000 00000',
      website: process.env.STORE_WEBSITE || 'www.yourstore.com',
      gstin: process.env.STORE_GSTIN || '',
      stateCode: process.env.STORE_STATE || 'DL',
      stateName: process.env.STORE_STATE_NAME || 'Delhi',
      grievanceOfficer: {
        name: process.env.GRIEVANCE_OFFICER_NAME || 'Your Name',
        email: process.env.GRIEVANCE_OFFICER_EMAIL || 'grievance@yourstore.com',
        phone: process.env.GRIEVANCE_OFFICER_PHONE || '+91 90000 00000',
      },
    },
  });
});

module.exports = router;
