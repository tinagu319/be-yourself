import { model, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    nickname: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    nicknameKey: { type: String, required: true, lowercase: true, trim: true },
    passwordSalt: { type: String, required: true, select: false },
    passwordHash: { type: String, required: true, select: false },
    registeredAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

userSchema.index({ nicknameKey: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
