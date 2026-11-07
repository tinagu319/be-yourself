import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShareRecap } from "./ShareRecap";
import type { DailyRecap } from "./types";
import "./demo.css";

// Standalone development fixture. Never imported by the production entry point.
const example: DailyRecap = {
  date: "2026-11-06",
  journeyDay: 99,
  summary: "Today, you conquered a mighty to-do list and got to work like a hero on a mission. Small steps, main-character energy. Your legend is growing!",
  stats: {
    completedTasks: 5,
    realWorkDurationMs: 2_705_000,
    virtualWorkDurationMs: 27_050_000,
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode><main className="by-share-demo"><ShareRecap recap={example} /></main></StrictMode>,
);
