export type DailyRecap = {
  date: string;
  summary: string;
  stats: {
    completedTasks: number;
    completedHealthTasks: number;
    realStudyDurationMs: number;
    virtualStudyDurationMs: number;
  };
};
