// CDN Manager — Debug Panel Route
// Credits: Developed by iddigital.pt

const express = require('express');
const path = require('path');

const router = express.Router();

// Serve the debug page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../admin/public/debug.html'));
});

module.exports = { debugRouter: router };
