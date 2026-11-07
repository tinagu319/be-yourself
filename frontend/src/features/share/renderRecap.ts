import type { DailyRecap } from "./types";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const WIDTH = 1080;
const CONTENT_WIDTH = 888;
const SUMMARY_WIDTH = CONTENT_WIDTH - 64;

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}

function validate(recap: DailyRecap) {
  const date = new Date(`${recap.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recap.date) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== recap.date) {
    throw new Error("Please provide a valid recap date (YYYY-MM-DD).");
  }
  if (!recap.summary.trim()) throw new Error("Please provide a daily summary.");
  if (!Number.isSafeInteger(recap.journeyDay) || recap.journeyDay < 99) {
    throw new Error("Please provide a valid self-discipline day.");
  }
  for (const [key, value] of Object.entries(recap.stats)) {
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER ||
        (key === "completedTasks" && !Number.isInteger(value))) {
      throw new Error("Daily statistics must contain valid non-negative counts and durations.");
    }
  }
}

/** Wraps English at spaces where possible, and CJK/long words by code point. */
function wrapSummary(ctx: CanvasRenderingContext2D, summary: string): string[] {
  const lines: string[] = [];
  for (const paragraph of summary.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > SUMMARY_WIDTH) {
        const space = line.lastIndexOf(" ");
        if (space > line.length / 2) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

/** Local PNG rendering. The component calls this only from the Share handler. */
export async function renderRecap(recap: DailyRecap): Promise<Blob> {
  validate(recap);
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the image. Please try again.");
  ctx.font = `400 32px ${FONT}`;
  const lines = wrapSummary(ctx, recap.summary);
  const storyHeight = Math.max(222, 112 + lines.length * 48);
  const statsTop = 420 + storyHeight + 62;
  const height = statsTop + 494;
  if (height > 16000) {
    throw new Error("The summary is too long for a single image. Please shorten it and press Share again.");
  }
  canvas.width = WIDTH;
  canvas.height = height;

  function text(value: string, x: number, y: number, size: number, color: string, weight = 400, maxWidth?: number) {
    ctx!.font = `${weight} ${size}px ${FONT}`;
    ctx!.fillStyle = color;
    ctx!.fillText(value, x, y, maxWidth);
  }
  function box(x: number, y: number, width: number, boxHeight: number, color: string, radius = 24) {
    ctx!.fillStyle = color;
    ctx!.beginPath();
    ctx!.roundRect(x, y, width, boxHeight, radius);
    ctx!.fill();
  }

  ctx.fillStyle = "#f7f6f0";
  ctx.fillRect(0, 0, WIDTH, height);
  box(40, 40, 1000, height - 80, "#fffefa", 32);
  box(96, 98, 48, 48, "#dce8d0", 15);
  text("b", 111, 132, 32, "#60794d", 700);
  text("Be Yourself", 160, 133, 28, "#35432d", 700);
  text(recap.date, 96, 208, 23, "#67715d");
  text(`Day ${recap.journeyDay}`, 96, 293, 66, "#293126", 700);
  text("of self-discipline.", 96, 371, 66, "#60794d", 700);

  box(96, 420, CONTENT_WIDTH, storyHeight, "#f1ede4");
  text("AI RECAP / JUST FOR FUN", 128, 470, 20, "#77572d", 700);
  lines.forEach((line, index) => text(line, 128, 526 + index * 48, 32, "#514a3e"));

  text("REAL RECORDS", 96, statsTop, 21, "#506741", 700);
  function count(label: string, value: number) {
    box(96, statsTop + 22, CONTENT_WIDTH, 112, "#eef3e8", 16);
    text(label, 120, statsTop + 56, 20, "#59694d");
    text(String(value), 120, statsTop + 103, 32, "#293d22", 650, 840);
  }
  count("Completed tasks", recap.stats.completedTasks);
  box(96, statsTop + 150, CONTENT_WIDTH, 94, "#eef3e8", 16);
  text("Actual work time", 120, statsTop + 186, 20, "#59694d");
  text(formatDuration(recap.stats.realWorkDurationMs), 120, statsTop + 223, 30, "#293d22", 650, 840);

  box(96, statsTop + 270, CONTENT_WIDTH, 106, "#f1ede4", 16);
  text("VIRTUAL WORK TIME", 120, statsTop + 305, 20, "#77572d", 700);
  text("Accelerated / not actual elapsed time", 120, statsTop + 350, 20, "#77572d");
  // Keep the accelerated figure separate from the real-time record.
  ctx.textAlign = "right";
  text(formatDuration(recap.stats.virtualWorkDurationMs), 960, statsTop + 350, 30, "#514a3e", 650, 400);
  ctx.textAlign = "left";

  text("A little effort counts. Be yourself.", 96, height - 72, 20, "#67715d");
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not export the PNG. Please try again.")), "image/png");
  });
}
