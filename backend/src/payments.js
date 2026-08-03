function razorpayEnabled() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function mockAllowed() {
  if (process.env.NODE_ENV === 'production') return false;
  return (process.env.PAYMENT_MODE || 'mock') === 'mock';
}

function onlineAvailable() {
  return razorpayEnabled() || mockAllowed();
}

module.exports = { razorpayEnabled, mockAllowed, onlineAvailable };
