import { model, Schema, type InferSchemaType } from "mongoose";

const activitySchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

const dailyRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Calendar date in YYYY-MM-DD form, based on the user's local day.
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    activities: { type: [activitySchema], default: [] },
  },
  { versionKey: false },
);

dailyRecordSchema.index({ userId: 1, date: 1 }, { unique: true });

export type DailyRecordDocument = InferSchemaType<typeof dailyRecordSchema>;
export const DailyRecordModel = model("DailyRecord", dailyRecordSchema);
