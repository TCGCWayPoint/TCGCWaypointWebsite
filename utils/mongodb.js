// lib/mongodb.js
import mongoose from 'mongoose';
export const MONGODB_URI = process.env.MONGODB_URI;


const connectToDatabase = async () => {
  if (mongoose.connections[0].readyState) {
    return; // Already connected
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

export default connectToDatabase;
