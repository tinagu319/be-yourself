import mongoose from "mongoose";

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to backend/.env before starting the API.");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");
}
