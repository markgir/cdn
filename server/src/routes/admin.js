const express = require('express');
const path = require('path');

const router = express.Router();

// Serve the main admin dashboard SPA
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../admin/public/index.html'));
});

module.exports = { adminRouter: router };
