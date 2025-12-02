const express = require('express');
const router = express.Router();
const Product = require('../models/Product');




router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || "";

    const results = await Product.find({
      $or: [
        { name: new RegExp(q, "i") },
        { description: new RegExp(q, "i") }
      ]
    })
      .limit(100)
      .populate('seller', 'shopName shopLogo address');

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});




router.get('/', async (req, res) => {
  try {
    const prods = await Product.find()
      .limit(200)
      .populate('seller', 'shopName shopLogo shopDescription address name location');
    res.json(prods);
  } catch (err) {
    console.error('Failed to list products', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});




router.get('/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id)
      .populate('seller', 'shopName shopLogo shopDescription address name location');
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    console.error('Get product error', err);
    res.status(400).json({ error: 'Invalid ID' });
  }
});

module.exports = router;
