import { useEffect, useState } from "react";
import "./taskBreakdown.css";

type RelatedTask = { _id: string; title: string; status: "active" | "completed" | "expired" };

export function TaskBreakdown({ taskId, token, onOpenTask }: { taskId: string; token: string; onOpenTask: (id: string) => Promise<void> }) {
  const [tasks, setTasks] = useState<RelatedTask[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/tasks/${taskId}/subtasks`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ subtasks: RelatedTask[] }>;
      }).then(body => { if (!controller.signal.aborted) setTasks(body.subtasks); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load related tasks. Reopen this task to try again."); });
    return () => controller.abort();
  }, [taskId, token]);

  if (!tasks.length && !error) return null;
  return <section className="task-steps" aria-label="Split tasks">
    <h2>Split tasks</h2>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <ul className="task-steps__list">{tasks.map(task => <li key={task._id}>
      <button type="button" className={`task-title ${task.status === "completed" ? "task-steps__done" : ""}`} onClick={() => void onOpenTask(task._id)}>{task.title}</button>
      <span className={`status-chip status-${task.status}`}>{task.status}</span>
    </li>)}</ul>
  </section>;
}
