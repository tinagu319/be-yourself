import { model, Schema, type InferSchemaType } from "mongoose";
import { TIME_MULTIPLIERS } from "./Task";

const segmentSchema = new Schema(
  {
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    multiplier: { type: Number, enum: TIME_MULTIPLIERS, required: true },
    realDurationMs: { type: Number, required: true, default: 0, min: 0 },
    virtualDurationMs: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const studySessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    status: {
      type: String,
      enum: ["running", "paused", "completed"],
      required: true,
      default: "running",
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    realDurationMs: { type: Number, required: true, default: 0, min: 0 },
    virtualDurationMs: { type: Number, required: true, default: 0, min: 0 },
    segments: { type: [segmentSchema], default: [] },
  },
  { versionKey: false },
);

studySessionSchema.index({ userId: 1, taskId: 1, startedAt: -1 });

export type StudySessionDocument = InferSchemaType<typeof studySessionSchema>;
export const StudySessionModel = model("StudySession", studySessionSchema);
