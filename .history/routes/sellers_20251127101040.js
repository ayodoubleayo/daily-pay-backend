
const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction'); // used to show seller purchases
const Order = require('../models/Order');             // <-- ensure Order model is imported


let History = null;
try {
  History = require('../models/History');
} catch (e) {

}

const authSeller = require('../middleware/authSeller');
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';


router.post('/register', async (req, res) => {
  try {
    const { shopName, email, password, phone, address } = req.body;

    if (!shopName || !email || !password)
      return res.status(400).json({ error: "Missing required fields" });

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await Seller.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: "Seller already exists" });

    const passwordHash = await bcryptjs.hash(password, 10);

    const seller = new Seller({

      name: shopName,
      shopName,
      email: normalizedEmail,
      passwordHash,
      phone,
      addressZ
    });

    await seller.save();

    res.json({ ok: true, seller: seller });
  } catch (err) {
    console.error('seller register error', err);
    res.status(500).json({ error: "Failed to register seller" });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const normalizedEmail = email.toLowerCase().trim();
    const seller = await Seller.findOne({ email: normalizedEmail });
    if (!seller)
      return res.status(400).json({ error: "Seller not found" });


    if (seller.banned) return res.status(403).json({ error: 'Account banned permanently' });
    if (seller.suspended) return res.status(403).json({ error: 'Account suspended by admin' });

    const isMatch = await bcryptjs.compare(password, seller.passwordHash);
    if (!isMatch)
      return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: seller._id, role: "seller" }, JWT_SECRET, {
      expiresIn: "7d"
    });

    const sellerObj = seller.toObject();
    delete sellerObj.passwordHash;

    res.json({ ok: true, token, seller: sellerObj });
  } catch (err) {
    console.error('seller login error', err);
    res.status(500).json({ error: "Failed to login seller" });
  }
});


