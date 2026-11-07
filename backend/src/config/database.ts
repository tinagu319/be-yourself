import mongoose from "mongoose";
import { TaskModel } from "../models/Task";

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to backend/.env before starting the API.");
  }

  await mongoose.connect(uri);
  // Create the replacement constraint before removing the known legacy index.
  await TaskModel.init();
  const indexes = await TaskModel.collection.indexes();
  const legacy = indexes.find(index =>
    index.name === "userId_1_activityDate_1_challengeId_1"
    && index.unique
    && index.key.userId === 1 && index.key.activityDate === 1 && index.key.challengeId === 1
    && Object.keys(index.key).length === 3
    && index.partialFilterExpression?.taskType === "health-challenge"
    && Object.keys(index.partialFilterExpression).every(key => key === "taskType" || key === "deletedAt")
    && (index.partialFilterExpression.deletedAt === undefined || index.partialFilterExpression.deletedAt === null),
  );
  if (legacy?.name) await TaskModel.collection.dropIndex(legacy.name);
  console.log("Connected to MongoDB.");
}
