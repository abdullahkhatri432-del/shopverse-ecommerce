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

// Valid Indian pincode first-3-digit prefixes (sorting districts).
// Source: India Post official ranges. This covers all ~19,000+ valid pincodes.
const pincodePrefixes = [
  // Delhi (110xxx)
  '110',
  // Haryana (121-127, 131-136)
  '121','122','123','124','125','126','127','131','132','133','134','135','136',
  // Punjab (140-149, 151-152, 160)
  '140','141','142','143','144','145','146','147','148','149','151','152','160',
  // Himachal Pradesh (171-177)
  '171','172','173','174','175','176','177',
  // Jammu & Kashmir (180-194)
  '180','181','182','183','184','185','186','187','188','189','190','191','192','193','194',
  // Uttar Pradesh (201-285)
  ...Array.from({length: 85}, (_, i) => String(201 + i).padStart(3, '0')),
  // Rajasthan (301-345)
  ...Array.from({length: 45}, (_, i) => String(301 + i).padStart(3, '0')),
  // Gujarat (360-396)
  ...Array.from({length: 37}, (_, i) => String(360 + i).padStart(3, '0')),
  // Maharashtra (400-445)
  ...Array.from({length: 46}, (_, i) => String(400 + i).padStart(3, '0')),
  // Madhya Pradesh (450-488)
  ...Array.from({length: 39}, (_, i) => String(450 + i).padStart(3, '0')),
  // Andhra Pradesh (500-535)
  ...Array.from({length: 36}, (_, i) => String(500 + i).padStart(3, '0')),
  // Karnataka (560-591)
  ...Array.from({length: 32}, (_, i) => String(560 + i).padStart(3, '0')),
  // Tamil Nadu (600-643)
  ...Array.from({length: 44}, (_, i) => String(600 + i).padStart(3, '0')),
  // Kerala (670-695)
  ...Array.from({length: 26}, (_, i) => String(670 + i).padStart(3, '0')),
  // West Bengal (700-743)
  ...Array.from({length: 44}, (_, i) => String(700 + i).padStart(3, '0')),
  // Odisha (751-770)
  ...Array.from({length: 20}, (_, i) => String(751 + i).padStart(3, '0')),
  // Bihar (800-855)
  ...Array.from({length: 56}, (_, i) => String(800 + i).padStart(3, '0')),
  // Jharkhand (814-835)
  ...Array.from({length: 22}, (_, i) => String(814 + i).padStart(3, '0')),
  // Chhattisgarh (490-497)
  ...Array.from({length: 8}, (_, i) => String(490 + i).padStart(3, '0')),
  // Uttarakhand (244-263)
  ...Array.from({length: 20}, (_, i) => String(244 + i).padStart(3, '0')),
  // Assam (781-788)
  ...Array.from({length: 8}, (_, i) => String(781 + i).padStart(3, '0')),
  // North East (790-799)
  '790','791','792','793','794','795','796','797','798','799',
  // Goa (403)
  '403',
  // Chandigarh (160)
  '160',
  // Puducherry (605, 607)
  '605','607',
  // Daman & Diu (396)
  '396',
  // Dadra & Nagar Haveli (396)
  '396',
  // Lakshadweep (682)
  '682',
  // Andaman & Nicobar (744)
  '744',
  // Telangana (500-509)
  '500','501','502','503','504','505','506','507','508','509',
];

const VALID_PINCODE_PREFIXES = new Set(pincodePrefixes);

function isValidPincode(pincode) {
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return false;
  const prefix = pincode.slice(0, 3);
  return VALID_PINCODE_PREFIXES.has(prefix);
}

function etaFor(pincode) {
  const first = Number(String(pincode)[0]);
  return REGIONS[first] || { label: 'Other', minDays: 4, maxDays: 7 };
}

router.post('/check', (req, res) => {
  const pincode = String(req.body?.pincode || '').trim();
  if (!isValidPincode(pincode)) {
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