import { model, Schema, type InferSchemaType } from "mongoose";

export const TIME_MULTIPLIERS = [1, 10, 20, 100] as const;
export const AVAILABLE_TIME_MULTIPLIERS = [1, 10, 100] as const;

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    taskType: {
      type: String,
      enum: ["personal", "health-challenge"],
      required: true,
      default: "personal",
    },
    // Health challenge tasks belong to one user's local calendar day.
    activityDate: {
      type: String,
      default: null,
      match: /^\d{4}-\d{2}-\d{2}$/,
      required: function (this: { taskType?: string }) {
        return this.taskType === "health-challenge";
      },
    },
    challengeId: {
      type: String,
      default: null,
      required: function (this: { taskType?: string }) {
        return this.taskType === "health-challenge";
      },
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 10000 },
    createdAt: { type: Date, required: true, default: Date.now },
    plannedStartAt: { type: Date, default: null },
    deadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "completed", "expired"],
      required: true,
      default: "active",
    },
    completedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    realDurationMs: { type: Number, required: true, default: 0, min: 0 },
    virtualDurationMs: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false },
);

taskSchema.index({ userId: 1, status: 1, deadline: 1 });
taskSchema.index({ userId: 1, parentTaskId: 1 });
taskSchema.index(
  { userId: 1, activityDate: 1, challengeId: 1 },
  {
    unique: true,
    partialFilterExpression: { taskType: "health-challenge", deletedAt: null },
  },
);

export type TaskDocument = InferSchemaType<typeof taskSchema>;
export const TaskModel = model("Task", taskSchema);
