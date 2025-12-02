
const mongoose = require('mongoose');

async function connectDB() {

  const uri = process.env.MONGODB_URI ||
              process.env.MONGO_URI ||
              process.env.MONGO_URL ||

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
