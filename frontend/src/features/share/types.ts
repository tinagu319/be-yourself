export type DailyRecap = {
  date: string;
  journeyDay: number;
  summary: string;
  stats: {
    completedTasks: number;
    realWorkDurationMs: number;
    virtualWorkDurationMs: number;
  };
};
