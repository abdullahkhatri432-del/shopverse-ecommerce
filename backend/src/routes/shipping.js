const express = require('express');

const router = express.Router();

const NON_SERVICEABLE_PREFIXES = ['9'];

const REGIONS = {
  1: { label: 'Delhi & NCR', minDays: 2, maxDays: 4 },
  2: { label: 'Northern India', minDays: 3, maxDays: 5 },
  3: { label: 'Western India', minDays: 3, maxDays: 5 },
  4: { label: 'Western & Central India', minDays: 3, maxDays: 5 },
  5: { label: 'Southern India', minDays: 2, maxDays: 4 },
  6: { label: 'Southern India', minDays: 3, maxDays: 5 },
  7: { label: 'Eastern India', minDays: 4, maxDays: 6 },
  8: { label: 'Eastern India', minDays: 4, maxDays: 6 },
};

function etaFor(pincode) {
  const first = Number(String(pincode)[0]);
  return REGIONS[first] || { label: 'Other', minDays: 4, maxDays: 7 };
}

router.post('/check', (req, res) => {
  const pincode = String(req.body?.pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({ error: 'Enter a valid 6-digit Indian pincode' });
  }
  if (NON_SERVICEABLE_PREFIXES.includes(pincode[0])) {
    return res.json({ serviceable: false, pincode, error: 'We do not currently deliver to this region.' });
  }
  const region = etaFor(pincode);
  res.json({
    serviceable: true,
    pincode,
    region: region.label,
    etaDays: { min: region.minDays, max: region.maxDays },
  });
});

module.exports = router;
