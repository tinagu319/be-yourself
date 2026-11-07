import { useEffect, useRef, useState, type FormEvent } from "react";

type Activity = { _id: string; text: string };
type ActivitiesResponse = { date: string; activities: Activity[]; error?: string };

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function readActivities(response: Response): Promise<ActivitiesResponse> {
  let body: ActivitiesResponse;
  try {
    body = await response.json() as ActivitiesResponse;
  } catch {
    throw new Error("Could not load your activities. Please try again.");
  }
  if (!response.ok) throw new Error(body.error || "Could not update your activities. Please try again.");
  return body;
}

export function DailyActivities({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const date = localDate();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ date, timeZone });
    void fetch(`/api/daily-activities?${query}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(readActivities).then(body => {
      if (!controller.signal.aborted) setActivities(body.activities);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Could not load your activities. Reopen this section to try again.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, token, date, timeZone]);

  async function update(activityId?: string) {
    if (inFlight.current || loading) return;
    const value = text.trim();
    if (!activityId && !value) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/daily-activities${activityId ? `/${activityId}` : ""}`, {
        method: activityId ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date, timeZone, ...(!activityId ? { text: value } : {}) }),
      });
      const body = await readActivities(response);
      setActivities(body.activities);
      if (!activityId) setText("");
    } catch (reason) {
      setError(reason instanceof TypeError ? "Could not save your changes. Check your connection and try again." : reason instanceof Error ? reason.message : "Could not save your changes. Please try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update();
  }

  return <details className="by-share__activities" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Other activities</summary>
    <p className="by-share__note">Add anything else you did today to include in your next share.</p>
    {error && <p className="by-share__error" role="alert">{error}</p>}
    {loading ? <p className="by-share__note" role="status">Loading...</p> : <ul>
      {activities.map(activity => <li key={activity._id}><span>{activity.text}</span><button type="button" className="by-share__remove" aria-label={`Delete activity: ${activity.text}`} disabled={saving} onClick={() => void update(activity._id)}>×</button></li>)}
    </ul>}
    <form onSubmit={add}>
      <input aria-label="Other activity" placeholder="What else did you do today?" maxLength={2000} value={text} onChange={event => setText(event.target.value)} disabled={saving || loading} />
      <button type="submit" disabled={saving || loading || !text.trim()}>{saving ? "Saving..." : "Add"}</button>
    </form>
  </details>;
}
