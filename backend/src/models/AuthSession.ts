import { model, Schema, type InferSchemaType } from "mongoose";

const authSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthSessionDocument = InferSchemaType<typeof authSessionSchema>;
export const AuthSessionModel = model("AuthSession", authSessionSchema);
