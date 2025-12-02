
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');

let History = null;
try {
  History = require('../models/History');
} catch (e) {
  History = null; // optional
}

const authSeller = require('../middleware/authSeller'); // expects seller auth
const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

/*
  Helper: get seller id from request (supports different auth shapes)
*/
function getSellerIdFromReq(req) {

  return (req.user && req.user.id) || (req.seller && req.seller.id) || req.sellerId || null;
}

/* ---------------------------
   Public: Register / Login
   --------------------------- */

router.post('/register', async (req, res) => {
  try {
    const { shopName, email, password, phone, address } = req.body;
    if (!shopName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await Seller.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ error: 'Seller already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const seller = new Seller({
      name: shopName,
      shopName,
      email: normalizedEmail,
      passwordHash,
      phone,
      address
    });

    await seller.save();
    res.json({ ok: true, seller: { id: seller._id, shopName: seller.shopName, email: seller.email } });
  } catch (err) {
    console.error('seller register error', err);
    res.status(500).json({ error: 'Failed to register seller' });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const normalizedEmail = email.toLowerCase().trim();
    const seller = await Seller.findOne({ email: normalizedEmail });
    if (!seller) return res.status(400).json({ error: 'Seller not found' });

    if (seller.banned) return res.status(403).json({ error: 'Account banned' });
    if (seller.suspended) return res.status(403).json({ error: 'Account suspended' });

    const ok = await bcrypt.compare(password, seller.passwordHash || '');
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: seller._id, role: 'seller' }, JWT_SECRET, { expiresIn: '30d' });
    const sellerObj = seller.toObject();
    delete sellerObj.passwordHash;

    res.json({ ok: true, token, seller: sellerObj });
  } catch (err) {
    console.error('seller login error', err);
    res.status(500).json({ error: 'Failed to login seller' });
  }
});

/* -----------------------------------
   Protected seller endpoints (authSeller)
   authSeller should set req.user.id or req.seller.id
   ----------------------------------- */


router.get('/me', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    if (!sellerId) return res.status(401).json({ error: 'Auth required' });

    const seller = await Seller.findById(sellerId).select('-passwordHash');
    if (!seller) return res.status(404).json({ error: 'Seller not found' });

    res.json({ ok: true, seller });
  } catch (err) {
    console.error('get seller me error', err);
    res.status(500).json({ error: 'Failed to fetch seller' });
  }
});


router.get('/me/products', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const products = await Product.find({ seller: sellerId }).limit(500);
    res.json(products);
  } catch (err) {
    console.error('seller products error', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


router.post('/me/products', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const { name, description, price = 0, qty = 1, images = [], category = null } = req.body;

    if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

    const product = await Product.create({
      name: name.trim(),
      description: description || '',
      price: Number(price),
      qty: Number(qty || 1),
      images: images || [],
      category: category || null,
      seller: sellerId
    });

    res.status(201).json({ ok: true, product });
  } catch (err) {
    console.error('create product error', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});


router.put('/me/products/:id', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    if (p.seller?.toString() !== sellerId?.toString()) return res.status(403).json({ error: 'Not allowed' });

    const updates = {};
    ['name', 'description', 'price', 'qty', 'images', 'category'].forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const updated = await Product.findByIdAndUpdate(p._id, updates, { new: true, runValidators: true });
    res.json({ ok: true, product: updated });
  } catch (err) {
    console.error('update product error', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});


router.delete('/me/products/:id', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    if (p.seller?.toString() !== sellerId?.toString()) return res.status(403).json({ error: 'Not allowed' });

    await p.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('delete product error', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});


router.get('/me/orders', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const orders = await Order.find({ seller: sellerId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, orders });
  } catch (err) {
    console.error('seller orders error', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});


router.get('/me/orders/:id', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.seller?.toString() !== sellerId?.toString()) return res.status(403).json({ error: 'Not allowed' });

    res.json({ ok: true, order });
  } catch (err) {
    console.error('get seller order error', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});


router.get('/me/transactions', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const txs = await Transaction.find({ sellerId }).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, transactions: txs });
  } catch (err) {
    console.error('seller transactions error', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});


router.get('/me/dashboard', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);

    const totalProducts = await Product.countDocuments({ seller: sellerId });
    const totalOrders = await Order.countDocuments({ seller: sellerId });
    const totalSalesAgg = await Transaction.aggregate([
      { $match: { sellerId: sellerId } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalSales = (totalSalesAgg[0] && totalSalesAgg[0].total) || 0;

    const pendingPayouts = await Transaction.countDocuments({ sellerId, status: 'pending' });

    res.json({
      ok: true,
      summary: {
        totalProducts,
        totalOrders,
        totalSales,
        pendingPayouts
      }
    });
  } catch (err) {
    console.error('seller dashboard error', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});


router.get('/me/bank-info', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const seller = await Seller.findById(sellerId).select('bankInfo');
    res.json({ ok: true, bankInfo: seller?.bankInfo || null });
  } catch (err) {
    console.error('get bank info error', err);
    res.status(500).json({ error: 'Failed to load bank info' });
  }
});

router.put('/me/bank-info', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const { accountName, accountNumber, bankName } = req.body;
    const updates = { bankInfo: { accountName, accountNumber, bankName } };
    const seller = await Seller.findByIdAndUpdate(sellerId, updates, { new: true });
    res.json({ ok: true, bankInfo: seller.bankInfo });
  } catch (err) {
    console.error('update bank info error', err);
    res.status(500).json({ error: 'Failed to update bank info' });
  }
});


router.post('/me/payout-request', authSeller, async (req, res) => {
  try {
    const sellerId = getSellerIdFromReq(req);
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const tx = await Transaction.create({
      sellerId,
      type: 'payout',
      amount: Number(amount),
      status: 'requested',
      createdAt: new Date()
    });

    res.json({ ok: true, payoutRequest: tx });
  } catch (err) {
    console.error('payout request error', err);
    res.status(500).json({ error: 'Failed to create payout request' });
  }
});


router.get('/me/history', authSeller, async (req, res) => {
  try {
    if (!History) return res.json({ ok: true, history: [] });
    const sellerId = getSellerIdFromReq(req);
    const h = await History.find({ seller: sellerId }).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, history: h });
  } catch (err) {
    console.error('seller history error', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/* -------------------------
   Admin-ish endpoints (optional)
   ------------------------- */
const authAdmin = (() => {
  try { return require('../middleware/authAdmin'); } catch(e){ 
    return (req, res, next) => {
      const secret = req.headers['x-admin-secret'] || req.query.adminSecret;
      if (!secret || secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Admin auth required' });
      next();
    };
  }
})();


router.get('/admin/list', authAdmin, async (req, res) => {
  try {
    const sellers = await Seller.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ ok: true, sellers });
  } catch (err) {
    console.error('admin list sellers error', err);
    res.status(500).json({ error: 'Failed to list sellers' });
  }
});


router.put('/admin/:id/approve', authAdmin, async (req, res) => {
  try {
    const s = await Seller.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    s.approved = true;
    await s.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('admin approve seller error', err);
    res.status(500).json({ error: 'Failed to approve seller' });
  }
});

module.exports = router;
     
