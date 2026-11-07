import { isValidObjectId, type Types } from "mongoose";
import { DailyRecordModel } from "../models/DailyRecord";
import { UserModel } from "../models/User";

const DAY_MS = 86_400_000;

/** Parse a Gregorian calendar date without relying on the server's timezone. */
export function parseLocalDate(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    throw new RangeError("Local date must be a valid YYYY-MM-DD calendar date.");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError("Local date must be a valid YYYY-MM-DD calendar date.");
  }
  return timestamp / DAY_MS;
}

function localDateAt(instant: Date, timeZone: string): string {
  if (typeof timeZone !== "string" || !timeZone.trim()) {
    throw new RangeError("An IANA timezone is required.");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

export interface UserActivitySummary {
  localDate: string;
  registeredAt: Date;
  registrationLocalDate: string;
  journeyDay: number;
  activeDates: string[];
  totalActiveDays: number;
  currentStreak: number;
}

/** Pure calendar calculation. Existing dates are retained; malformed legacy dates are ignored. */
export function calculateUserActivity(
  registeredAt: Date, localDate: string, timeZone: string, activeDates: readonly string[],
): UserActivitySummary {
  const today = parseLocalDate(localDate);
  const registrationLocalDate = localDateAt(registeredAt, timeZone);
  const registrationDay = parseLocalDate(registrationLocalDate);
  if (today < registrationDay) throw new RangeError("Local date precedes registration.");
  const days = new Map<number, string>();
  for (const date of activeDates) {
    try {
      const day = parseLocalDate(date);
      if (day <= today) days.set(day, date);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  // A streak remains current until the day after the last active date has passed.
  let cursor = days.has(today) ? today : today - 1;
  let currentStreak = 0;
  while (days.has(cursor)) {
    currentStreak++;
    cursor--;
  }
  const dates = [...days.values()].sort();
  return {
    localDate, registeredAt, registrationLocalDate,
    journeyDay: 99 + today - registrationDay,
    activeDates: dates, totalActiveDays: dates.length, currentStreak,
  };
}

async function loadUser(userId: string | Types.ObjectId, localDate: string, timeZone: string) {
  parseLocalDate(localDate);
  // Validate timezone before querying or writing anything.
  localDateAt(new Date(), timeZone);
  if (!isValidObjectId(userId)) throw new RangeError("Invalid user ID.");
  const user = await UserModel.findById(userId).select("registeredAt").lean();
  if (!user) throw new Error("User not found.");
  calculateUserActivity(user.registeredAt, localDate, timeZone, []);
  return user;
}

async function summarize(userId: string | Types.ObjectId, registeredAt: Date, localDate: string, timeZone: string) {
  // DailyRecord existence represents activity, including historical records.
  const records = await DailyRecordModel.find({ userId, date: { $lte: localDate } }).select("date").lean();
  return calculateUserActivity(registeredAt, localDate, timeZone, records.map(record => record.date));
}

/** Read only: does not mark today active or change registration/history. */
export async function getUserActivity(userId: string | Types.ObjectId, localDate: string, timeZone: string) {
  const user = await loadUser(userId, localDate, timeZone);
  return summarize(userId, user.registeredAt, localDate, timeZone);
}

/** Record today's local date. Historical backfill and future recording are not supported. */
export async function recordUserActivity(userId: string | Types.ObjectId, localDate: string, timeZone: string) {
  const user = await loadUser(userId, localDate, timeZone);
  if (localDate !== localDateAt(new Date(), timeZone)) {
    throw new RangeError("Only the user's current local date can be recorded.");
  }
  // Wait for the existing unique (userId, date) index before allowing concurrent writes.
  await DailyRecordModel.init();
  try {
    await DailyRecordModel.updateOne(
      { userId, date: localDate },
      { $setOnInsert: { userId, date: localDate } },
      { upsert: true, runValidators: true },
    );
  } catch (error) {
    // Another request may have inserted this exact day after the upsert matched nothing.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)
      || !await DailyRecordModel.exists({ userId, date: localDate })) throw error;
  }
  // Derive totals from unique dates instead of a separately incremented counter.
  return summarize(userId, user.registeredAt, localDate, timeZone);
}
