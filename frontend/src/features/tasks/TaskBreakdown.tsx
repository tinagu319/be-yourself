import { useEffect, useRef, useState, type FormEvent } from "react";
import "./taskBreakdown.css";

type Subtask = { _id: string; title: string; status: "active" | "completed" | "expired" };
class StepError extends Error {}

async function read<T>(response: Response): Promise<T> {
  try {
    const body = await response.json() as T & { error?: string };
    if (!response.ok) throw new StepError(body.error || "Could not update your steps. Please try again.");
    return body;
  } catch (error) {
    if (error instanceof StepError) throw error;
    throw new StepError("Could not update your steps. Please try again.");
  }
}

export function TaskBreakdown({ taskId, token, editable }: { taskId: string; token: string; editable: boolean }) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "generating" | "saving" | "updating">("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const action = useRef<AbortController | null>(null);
  const base = `/api/tasks/${taskId}`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDrafts([]);
    void fetch(`${base}/subtasks`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(read<{ subtasks: Subtask[] }>).then(body => {
        if (!controller.signal.aborted) setSubtasks(body.subtasks);
      }).catch(() => {
        if (!controller.signal.aborted) setError("Could not load your steps. Reopen this task to try again.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); action.current?.abort(); };
  }, [base, token]);

  async function run<T>(operation: "generating" | "saving" | "updating", path: string, body: unknown, method = "POST"): Promise<T | undefined> {
    if (inFlight.current || !editable) return;
    inFlight.current = true;
    setBusy(operation);
    setError("");
    const controller = new AbortController();
    action.current = controller;
    try {
      const result = await read<T>(await fetch(`${base}/${path}`, { method, headers, body: JSON.stringify(body), signal: controller.signal }));
      return controller.signal.aborted ? undefined : result;
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof StepError ? reason.message : "Could not connect. Please try again.");
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted) setBusy("");
    }
  }

  async function generate() {
    const body = await run<{ suggestions: string[] }>("generating", "breakdown", {});
    if (body) setDrafts(body.suggestions);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = await run<{ subtasks: Subtask[] }>("saving", "subtasks", { titles: drafts.map(title => title.trim()) });
    if (body) {
      setSubtasks(current => [...current, ...body.subtasks]);
      setDrafts([]);
    }
  }

  async function complete(subtask: Subtask, completed: boolean) {
    const body = await run<{ subtask: Subtask }>("updating", `subtasks/${subtask._id}`, { completed }, "PATCH");
    if (body) setSubtasks(current => current.map(step => step._id === subtask._id ? body.subtask : step));
  }

  return <section className="task-steps" aria-label="Subtasks">
    <div className="task-steps__heading"><h2>Subtasks</h2>
      {editable && !subtasks.length && !drafts.length && <button className="doit-button" type="button" disabled={loading || !!busy} onClick={() => void generate()}>{busy === "generating" ? "Generating..." : "Break down with AI"}</button>}
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <p className="empty" role="status">Loading steps...</p> : <ul className="task-steps__list">
      {subtasks.map(step => <li key={step._id}><label><input type="checkbox" checked={step.status === "completed"} disabled={!editable || !!busy || step.status === "expired"} onChange={event => void complete(step, event.target.checked)} /><span className={step.status === "completed" ? "task-steps__done" : ""}>{step.title}</span></label></li>)}
      {!subtasks.length && !drafts.length && <li className="empty">No subtasks yet.</li>}
    </ul>}
    {editable && drafts.length > 0 && <form onSubmit={save}>
      <p className="task-steps__hint">Review and edit these suggestions before saving.</p>
      <ol className="task-steps__drafts">{drafts.map((title, index) => <li key={index}>
        <input aria-label={`Step ${index + 1}`} required maxLength={200} value={title} disabled={!!busy} onChange={event => setDrafts(current => current.map((value, position) => position === index ? event.target.value : value))} />
        <button type="button" className="icon-button danger-icon" aria-label={`Remove step ${index + 1}`} disabled={!!busy} onClick={() => setDrafts(current => current.filter((_, position) => position !== index))}>×</button>
      </li>)}</ol>
      <div className="details-edit-actions"><button className="primary-button" type="submit" disabled={!!busy || drafts.some(title => !title.trim())}>{busy === "saving" ? "Saving..." : "Save subtasks"}</button><button className="cancel-button" type="button" disabled={!!busy} onClick={() => setDrafts([])}>Cancel</button></div>
    </form>}
  </section>;
}
