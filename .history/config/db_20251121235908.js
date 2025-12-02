const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI ||
    process.env.MONGO_URL ||

    'mongodb+srv://ayo-ecom:CBZoMcMAY4sd0j7Y@cluster0.qyzmvty.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=Cluster0';

  try {
    await mongoose.connect(uri, {

      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);

    process.exit(1);
  }
}

module.exports = connectDB;
