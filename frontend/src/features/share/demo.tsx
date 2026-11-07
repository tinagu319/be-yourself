import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShareRecap } from "./ShareRecap";
import type { DailyRecap } from "./types";
import "./demo.css";

// Standalone development fixture. Never imported by the production entry point.
const example: DailyRecap = {
  date: "2026-11-06",
  summary: "Today, you conquered three mighty tasks, collected two healthy wins, and entered the study room like a scholar on a mission. Small steps, main-character energy. Your legend is growing!",
  stats: {
    completedTasks: 3,
    completedHealthTasks: 2,
    realStudyDurationMs: 2_705_000,
    virtualStudyDurationMs: 27_050_000,
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode><main className="by-share-demo"><ShareRecap recap={example} /></main></StrictMode>,
);
