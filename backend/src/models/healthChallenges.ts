import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import { TaskModel } from "./Task";

export const HEALTH_CHALLENGE_POOL = [
  { id: "drink-water", title: "Drink a glass of water" },
  { id: "refill-water", title: "Refill your water bottle" },
  { id: "water-before-coffee", title: "Have some water before your next coffee" },
  { id: "short-walk", title: "Take a five-minute walk" },
  { id: "stretch-legs", title: "Stand up and stretch your legs" },
  { id: "shoulder-rolls", title: "Roll your shoulders for a moment" },
  { id: "take-stairs", title: "Take the stairs for one floor" },
  { id: "fresh-air", title: "Step outside for a breath of fresh air" },
  { id: "look-distance", title: "Look at something far away for 20 seconds" },
  { id: "screen-break", title: "Take a short screen break" },
  { id: "blink-break", title: "Pause and give your eyes a gentle blink break" },
  { id: "close-eyes", title: "Close your eyes and rest them for a moment" },
  { id: "deep-breaths", title: "Take five slow, deep breaths" },
  { id: "relax-jaw", title: "Unclench your jaw and relax your face" },
  { id: "quiet-minute", title: "Enjoy one quiet minute without a screen" },
  { id: "name-a-good-thing", title: "Name one thing that went well today" },
  { id: "eat-fruit", title: "Eat a piece of fruit" },
  { id: "add-vegetable", title: "Add a vegetable to one meal" },
  { id: "balanced-snack", title: "Choose a nourishing snack" },
  { id: "sit-for-meal", title: "Take a few minutes to enjoy a meal" },
  { id: "tidy-one-spot", title: "Tidy one small spot around you" },
  { id: "make-bed", title: "Make your bed or straighten your blanket" },
  { id: "wash-hands", title: "Wash your hands and reset for the day" },
  { id: "sunlight", title: "Get a moment of daylight" },
  { id: "text-kindness", title: "Send someone a kind message" },
  { id: "write-one-line", title: "Write one sentence about your day" },
  { id: "prepare-tomorrow", title: "Set out one thing for tomorrow" },
  { id: "listen-song", title: "Listen to one song you enjoy" },
  { id: "put-phone-down", title: "Put your phone down for five minutes" },
  { id: "early-wind-down", title: "Give yourself five minutes to wind down" },
] as const;

export type HealthChallenge = (typeof HEALTH_CHALLENGE_POOL)[number];

function pickRandomChallenges(pool: readonly HealthChallenge[], count: number): HealthChallenge[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function pickFiveHealthChallenges(): HealthChallenge[] {
  return pickRandomChallenges(HEALTH_CHALLENGE_POOL, 5);
}

/**
 * Creates the five daily challenges as ordinary task records for one user.
 * Existing tasks are reused, so opening the Dashboard cannot reshuffle the day.
 */
export async function ensureDailyHealthChallengeTasks(userId: Types.ObjectId, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  const query = { userId, taskType: "health-challenge", activityDate: date, deletedAt: null } as const;
  const existing = await TaskModel.find(query).sort({ challengeId: 1 });
  if (existing.length >= 5) return existing;

  const existingIds = new Set(existing.map((task) => task.challengeId));
  const available = HEALTH_CHALLENGE_POOL.filter((challenge) => !existingIds.has(challenge.id));
  const missing = pickRandomChallenges(available, 5 - existing.length);

  try {
    await TaskModel.insertMany(
      missing.map((challenge) => ({
        userId,
        title: challenge.title,
        taskType: "health-challenge",
        activityDate: date,
        challengeId: challenge.id,
      })),
      { ordered: false },
    );
  } catch (error) {
    // A concurrent request may have created the same day's challenge tasks.
    // Ignore that race only when the unique per-user/day/challenge index won.
    const records = await TaskModel.find(query).sort({ challengeId: 1 });
    if (records.length < 5) throw error;
    return records;
  }

  return TaskModel.find(query).sort({ challengeId: 1 });
}
