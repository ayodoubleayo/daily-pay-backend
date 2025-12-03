const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,  // ⏳ extend server selection timeout
      socketTimeoutMS: 45000,           // ⏳ allow long-running queries
      connectTimeoutMS: 30000,          // ⏳ extend initial connection timeout
      retryWrites: true,
    });

    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
