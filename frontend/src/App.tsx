import { FormEvent, useEffect, useState } from "react";
import { ShareRecap, type DailyRecap } from "./features/share";

type User = { id: string; nickname: string; registeredAt: string };
type Task = {
  _id: string;
  title: string;
  description: string;
  taskType: "personal" | "health-challenge";
  plannedStartAt: string | null;
  deadline: string | null;
  status: "active" | "completed" | "expired";
  createdAt: string;
  completedAt: string | null;
  realDurationMs: number;
  virtualDurationMs: number;
};
type StudySegment = {
  startedAt: string;
  endedAt: string | null;
  multiplier: number;
};
type StudySession = {
  _id: string;
  taskId: string;
  status: "running" | "paused" | "completed";
  realDurationMs: number;
  virtualDurationMs: number;
  segments: StudySegment[];
};
type ApiError = { error?: string };
type AuthResponse = { token: string; user: User } & ApiError;
type TaskResponse = { tasks?: Task[]; task?: Task } & ApiError;
type SessionResponse = { session?: StudySession | null } & ApiError;
type TaskDetailsResponse = {
  task: Task;
  firstStudyStartedAt: string | null;
  lastSessionEndedAt: string | null;
} & ApiError;

const TOKEN_KEY = "be-yourself-session-token";
const GENERIC_API_ERROR = "We couldn't complete that request. Please try again.";
const focusModes = [
  { multiplier: 1, label: "Gentle Focus" },
  { multiplier: 10, label: "Deep Focus" },
  { multiplier: 100, label: "Super Focus" },
] as const;

class ApiMessageError extends Error {}

function localDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function journeyDay(registeredAt: string) {
  const registeredDate = new Date(registeredAt);
  const today = new Date();
  const registeredDay = Date.UTC(registeredDate.getFullYear(), registeredDate.getMonth(), registeredDate.getDate());
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return 99 + Math.max(0, Math.floor((currentDay - registeredDay) / 86_400_000));
}

function formatTimer(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, "0")).join(":");
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function ActionIcon({ name }: { name: "edit" | "delete" | "play" }) {
  if (name === "play") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" /></svg>;
  if (name === "delete") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" /></svg>;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    if (!response.ok) throw new ApiMessageError(GENERIC_API_ERROR);
    return {} as T;
  }

  const raw = await response.text();
  let body: (T & ApiError) | undefined;
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as T & ApiError;
    } catch {
      throw new ApiMessageError(GENERIC_API_ERROR);
    }
  }

  if (!response.ok) throw new ApiMessageError(body?.error || GENERIC_API_ERROR);
  if (!body) throw new ApiMessageError(GENERIC_API_ERROR);
  return body;
}

function userErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiMessageError ? reason.message : fallback;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState<User | null>(null);
  const [activityJourneyDay, setActivityJourneyDay] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [newTask, setNewTask] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailTimes, setDetailTimes] = useState<{ firstStudyStartedAt: string | null; lastSessionEndedAt: string | null }>({ firstStudyStartedAt: null, lastSessionEndedAt: null });
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailDraft, setDetailDraft] = useState({ title: "", description: "", plannedStartAt: "", deadline: "" });
  const [studyTask, setStudyTask] = useState<Task | null>(null);
  const [studySession, setStudySession] = useState<StudySession | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    let lastRecordedDay = "";
    let pending = false;
    let midnightTimer: number;
    setActivityJourneyDay(null);
    const recordToday = async () => {
      if (document.visibilityState === "hidden" || pending) return;
      const date = localDateKey();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const key = `${date}/${timeZone}`;
      if (lastRecordedDay === key) return;
      pending = true;
      try {
        const response = await fetch("/api/user-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ date, timeZone }),
        });
        const body = await readResponse<{ journeyDay: number }>(response);
        if (!cancelled) {
          lastRecordedDay = key;
          setActivityJourneyDay(body.journeyDay);
        }
      } catch (reason) {
        if (!cancelled) setError(userErrorMessage(reason, "Could not save today's activity. Please try again."));
      } finally {
        pending = false;
      }
    };
    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = window.setTimeout(() => {
        void recordToday();
        scheduleMidnight();
      }, midnight.getTime() - now.getTime() + 100);
    };
    const onVisible = () => { void recordToday(); };
    void recordToday();
    scheduleMidnight();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!studySession || studySession.status !== "running") return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [studySession?.status]);

  useEffect(() => {
    if (!token) return;
    const nextDeadline = tasks
      .filter(task => task.taskType === "personal" && task.status === "active" && task.deadline)
      .map(task => new Date(task.deadline!).getTime())
      .filter(deadline => deadline > Date.now())
      .sort((a, b) => a - b)[0];
    if (!nextDeadline) return;
    const delay = Math.min(Math.max(nextDeadline - Date.now() + 100, 0), 2_147_000_000);
    const timeout = window.setTimeout(() => { void loadTasks(token).catch(reason => setError(userErrorMessage(reason, "Could not refresh expired tasks."))); }, delay);
    return () => window.clearTimeout(timeout);
  }, [tasks, token]);

  const loadTasks = async (sessionToken: string) => {
    const response = await fetch(`/api/tasks?date=${localDateKey()}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const body = await readResponse<TaskResponse>(response);
    setTasks(body.tasks || []);
  };

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        const body = await readResponse<{ user: User }>(response);
        if (cancelled) return;
        setUser(body.user);
        await loadTasks(token);
      } catch (reason) {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setTasks([]);
        setError(userErrorMessage(reason, "Could not restore your session. Please try again."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restoreSession();
    return () => { cancelled = true; };
  }, [token]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      const body = await readResponse<AuthResponse>(response);
      localStorage.setItem(TOKEN_KEY, body.token);
      setUser(body.user);
      setToken(body.token);
      setPassword("");
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not sign in. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || !token) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      await readResponse<TaskResponse>(response);
      setNewTask("");
      await loadTasks(token);
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not add the task. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const generateDailyRecap = async (): Promise<DailyRecap> => {
    try {
      const response = await fetch("/api/daily-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: localDateKey(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      return await readResponse<DailyRecap>(response);
    } catch (reason) {
      throw new Error(userErrorMessage(reason, "Could not create your daily recap. Please try again."));
    }
  };

  const setTaskCompletion = async (task: Task, completed: boolean) => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task._id}/completion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completed }),
      });
      const body = await readResponse<TaskResponse>(response);
      if (body.task) {
        setTasks(current => current.map(item => item._id === task._id ? body.task! : item));
        setDetailTask(current => current?._id === task._id ? body.task! : current);
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not update the task. Please try again."));
    }
  };

  const saveTaskTitle = async (task: Task, value: string) => {
    setEditingTaskId(null);
    const title = value.trim();
    if (!title || title === task.title || !token) return;
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      const body = await readResponse<TaskResponse>(response);
      if (body.task) {
        setTasks(current => current.map(item => item._id === task._id ? body.task! : item));
        setStudyTask(current => current?._id === task._id ? body.task! : current);
        setDetailTask(current => current?._id === task._id ? body.task! : current);
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not update the task. Please try again."));
    }
  };

  const deleteTask = async (task: Task) => {
    if (!token || !window.confirm(`Delete “${task.title}”?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await readResponse<{}>(response);
      setTasks(current => current.filter(item => item._id !== task._id));
      if (detailTask?._id === task._id) setDetailTask(null);
      if (studyTask?._id === task._id) {
        setStudyTask(null);
        setStudySession(null);
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not delete the task. Please try again."));
    }
  };

  const openTaskDetails = async (taskId: string) => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse<TaskDetailsResponse>(response);
      setDetailTask(body.task);
      setDetailTimes({ firstStudyStartedAt: body.firstStudyStartedAt, lastSessionEndedAt: body.lastSessionEndedAt });
      setDetailDraft({
        title: body.task.title,
        description: body.task.description || "",
        plannedStartAt: toLocalDateTimeInput(body.task.plannedStartAt),
        deadline: toLocalDateTimeInput(body.task.deadline),
      });
      setDetailEditing(false);
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not open task details. Please try again."));
    }
  };

  const saveTaskDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !detailTask) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${detailTask._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: detailDraft.title,
          description: detailDraft.description,
          plannedStartAt: fromLocalDateTimeInput(detailDraft.plannedStartAt),
          deadline: fromLocalDateTimeInput(detailDraft.deadline),
        }),
      });
      const body = await readResponse<TaskResponse>(response);
      if (body.task) {
        setDetailTask(body.task);
        setTasks(current => current.map(task => task._id === body.task!._id ? body.task! : task));
        setDetailDraft({ title: body.task.title, description: body.task.description || "", plannedStartAt: toLocalDateTimeInput(body.task.plannedStartAt), deadline: toLocalDateTimeInput(body.task.deadline) });
        setDetailEditing(false);
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not save task details. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const openStudyRoom = async (task: Task) => {
    if (!token) return;
    setDetailTask(null);
    setStudyTask(task);
    setStudySession(null);
    setError("");
    try {
      const response = await fetch(`/api/study-sessions/active?taskId=${task._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse<SessionResponse>(response);
      const session = body.session ?? null;
      setStudySession(session);
      const savedMultiplier = session?.segments.at(-1)?.multiplier ?? 1;
      setMultiplier(session?.status === "paused" && savedMultiplier === 20 ? 10 : savedMultiplier);
      setTimerNow(Date.now());
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not open the task timer. Please try again."));
    }
  };

  const startOrResumeStudy = async () => {
    if (!token || !studyTask || studySession?.status === "running") return;
    setError("");
    try {
      const isPaused = studySession?.status === "paused";
      const response = await fetch(isPaused
        ? `/api/study-sessions/${studySession._id}/resume`
        : "/api/study-sessions", {
          method: isPaused ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(isPaused ? { multiplier } : { taskId: studyTask._id, multiplier }),
        });
      const body = await readResponse<SessionResponse>(response);
      if (body.session) {
        setStudySession(body.session);
        setMultiplier(body.session.segments.at(-1)?.multiplier ?? multiplier);
        setTimerNow(Date.now());
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not start the timer. Please try again."));
    }
  };

  const pauseStudy = async () => {
    if (!token || !studySession || studySession.status !== "running") return;
    setError("");
    try {
      const response = await fetch(`/api/study-sessions/${studySession._id}/pause`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse<SessionResponse>(response);
      if (body.session) {
        setStudySession(body.session);
        const savedMultiplier = body.session.segments.at(-1)?.multiplier ?? 1;
        setMultiplier(savedMultiplier === 20 ? 10 : savedMultiplier);
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not pause the timer. Please try again."));
    }
  };

  const leaveTimer = async () => {
    if (token && studySession?.status === "running") {
      setError("");
      try {
        const response = await fetch(`/api/study-sessions/${studySession._id}/pause`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        await readResponse<SessionResponse>(response);
      } catch (reason) {
        setError(userErrorMessage(reason, "Could not pause the timer. Please try again."));
        return;
      }
    }
    setStudyTask(null);
    setStudySession(null);
  };

  const changeMultiplier = async (value: number) => {
    setMultiplier(value);
    if (!token || !studySession || studySession.status !== "running" || studySession.segments.at(-1)?.multiplier === value) return;
    setError("");
    try {
      const response = await fetch(`/api/study-sessions/${studySession._id}/multiplier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ multiplier: value }),
      });
      const body = await readResponse<SessionResponse>(response);
      if (body.session) {
        setStudySession(body.session);
        setTimerNow(Date.now());
      }
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not change the time speed. Please try again."));
    }
  };

  const endStudy = async () => {
    if (!token || !studySession) return;
    setError("");
    try {
      const response = await fetch(`/api/study-sessions/${studySession._id}/stop`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      await readResponse<SessionResponse>(response);
      await loadTasks(token);
      setStudyTask(null);
      setStudySession(null);
    } catch (reason) {
      setError(userErrorMessage(reason, "Could not save the session. Please try again."));
    }
  };

  const signOut = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      } catch { /* Clear the local session even if the server cannot be reached. */ }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setTasks([]);
    setDetailTask(null);
    setStudyTask(null);
    setStudySession(null);
    setError("");
  };

  const activeSegment = studySession?.segments.at(-1);
  const segmentElapsed = studySession?.status === "running" && activeSegment && !activeSegment.endedAt
    ? Math.max(0, timerNow - new Date(activeSegment.startedAt).getTime())
    : 0;
  const virtualTimeMs = (studySession?.virtualDurationMs ?? 0) + segmentElapsed * (activeSegment?.multiplier ?? multiplier);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home"><span className="brand-mark">b.</span> be yourself</a>
        {user && <div className="user-menu"><span>{user.nickname}</span><button onClick={() => void signOut()}>Log out</button></div>}
      </header>
      <section className="content" id="home">
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading ? <div className="loading-state">Getting your day ready…</div> : user ? studyTask ? (
          <section className="study-room">
            <button className="back-button" onClick={() => void leaveTimer()}>← &nbsp; Back to tasks</button>
            <div className="room-heading"><p className="eyebrow">TASK TIMER</p><h1>{studyTask.title}</h1><p className="subheading">A focused session, at your pace.</p></div>
            <div className="room-timer">
              <div><span>VIRTUAL TIME</span><strong className="virtual-time">{formatTimer(virtualTimeMs)}</strong></div>
            </div>
            <div className="room-speed"><span>FOCUS MODE</span>{focusModes.map(mode => <button key={mode.multiplier} className={multiplier === mode.multiplier ? "selected" : ""} onClick={() => void changeMultiplier(mode.multiplier)}>{mode.label}</button>)}</div>
            <div className="room-controls">
              {!studySession && <button className="primary-button" onClick={() => void startOrResumeStudy()}>Start focus</button>}
              {studySession?.status === "paused" && <button className="primary-button" onClick={() => void startOrResumeStudy()}>Resume</button>}
              {studySession?.status === "running" && <button className="pause-button" onClick={() => void pauseStudy()}>Pause</button>}
              {studySession && <button className="end-button" onClick={() => void endStudy()}>End session & return</button>}
            </div>
            <p className="room-note">Returning to tasks pauses this session without ending it. Resume when you come back.</p>
          </section>
        ) : detailTask ? (
          <section className="panel task-details">
            <button className="back-button" onClick={() => { setDetailTask(null); setDetailEditing(false); }}>← &nbsp; Back to tasks</button>
            <div className="details-heading">
              <div><p className="eyebrow">TASK DETAILS</p><h1>{detailTask.title}</h1></div>
              <span className={`status-chip status-${detailTask.status}`}>{detailTask.status}</span>
            </div>
            <div className="details-actions">
              <label className="complete-control"><input type="checkbox" checked={detailTask.status === "completed"} disabled={detailTask.status === "expired"} onChange={event => void setTaskCompletion(detailTask, event.target.checked)} /> Mark complete</label>
              <button className="icon-button" title="Edit task" aria-label="Edit task" onClick={() => { setDetailDraft({ title: detailTask.title, description: detailTask.description || "", plannedStartAt: toLocalDateTimeInput(detailTask.plannedStartAt), deadline: toLocalDateTimeInput(detailTask.deadline) }); setDetailEditing(true); }}><ActionIcon name="edit" /></button>
              <button className="icon-button danger-icon" title="Delete task" aria-label="Delete task" onClick={() => void deleteTask(detailTask)}><ActionIcon name="delete" /></button>
              <button className="doit-button" onClick={() => void openStudyRoom(detailTask)}><ActionIcon name="play" /><span>Do it now</span></button>
            </div>
            {detailEditing ? <form className="details-edit-form" onSubmit={saveTaskDetails}>
              <label>Title<input required maxLength={200} value={detailDraft.title} onChange={event => setDetailDraft(current => ({ ...current, title: event.target.value }))} /></label>
              <label>Description<textarea rows={4} maxLength={10000} value={detailDraft.description} onChange={event => setDetailDraft(current => ({ ...current, description: event.target.value }))} /></label>
              <label>Planned start<input type="datetime-local" value={detailDraft.plannedStartAt} onChange={event => setDetailDraft(current => ({ ...current, plannedStartAt: event.target.value }))} /></label>
              <label>Planned finish<input type="datetime-local" value={detailDraft.deadline} onChange={event => setDetailDraft(current => ({ ...current, deadline: event.target.value }))} /></label>
              <div className="details-edit-actions"><button className="primary-button" type="submit" disabled={saving}>Save changes</button><button className="cancel-button" type="button" onClick={() => setDetailEditing(false)}>Cancel</button></div>
            </form> : <>
              <p className="detail-description">{detailTask.description || "No description."}</p>
              <div className="detail-facts">
                <div><span>Created</span><strong>{formatDateTime(detailTask.createdAt)}</strong></div>
                <div><span>Planned start</span><strong>{formatDateTime(detailTask.plannedStartAt)}</strong></div>
                <div><span>Planned finish</span><strong>{formatDateTime(detailTask.deadline)}</strong></div>
                <div><span>First focus started</span><strong>{formatDateTime(detailTimes.firstStudyStartedAt)}</strong></div>
                <div><span>Last focus ended</span><strong>{formatDateTime(detailTimes.lastSessionEndedAt)}</strong></div>
                <div><span>Completed</span><strong>{formatDateTime(detailTask.completedAt)}</strong></div>
                <div><span>Real study time</span><strong>{formatTimer(detailTask.realDurationMs)}</strong></div>
                <div><span>Virtual study time</span><strong>{formatTimer(detailTask.virtualDurationMs)}</strong></div>
              </div>
            </>}
          </section>
        ) : (
          <>
            <div className="welcome-row">
              <div><p className="eyebrow">YOUR SPACE · {localDateKey()}</p><h1>Your day, your pace.</h1></div>
              <div className="day-mark"><span>JOURNEY</span><strong>DAY {activityJourneyDay ?? journeyDay(user.registeredAt)}</strong></div>
            </div>
            <section className="panel tasks-panel">
              <div className="panel-head"><div><p className="eyebrow">TODAY</p><h2>Tasks</h2></div><span className="quiet-label">{tasks.filter(task => task.status === "completed").length} done</span></div>
              <div className="task-list">
                {tasks.length === 0 && <p className="empty">Nothing on the list yet.</p>}
                {tasks.map(task => <article className={`task-row ${task.status === "completed" ? "is-done" : ""}`} key={task._id}>
                  <input type="checkbox" checked={task.status === "completed"} onChange={event => void setTaskCompletion(task, event.target.checked)} aria-label={`Mark ${task.title} ${task.status === "completed" ? "incomplete" : "complete"}`} />
                  {editingTaskId === task._id ? <input className="edit-title" autoFocus value={editingTitle} maxLength={200} onChange={event => setEditingTitle(event.target.value)} onBlur={() => setEditingTaskId(null)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveTaskTitle(task, editingTitle); } if (event.key === "Escape") setEditingTaskId(null); }} aria-label="Edit task title" /> : <button className="task-title" onClick={() => void openTaskDetails(task._id)} title="Open task details">{task.title}</button>}
                  {task.taskType === "health-challenge" && <span className="task-badge">DAILY 5</span>}
                  {task.deadline && <span className="deadline">Due {new Date(task.deadline).toLocaleDateString([], { month: "short", day: "numeric" })}{new Date(task.deadline).toLocaleDateString() === new Date().toLocaleDateString() ? `, ${new Date(task.deadline).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>}
                  <div className="task-actions">
                    <button className="doit-button" aria-label={`Do it now: ${task.title}`} onClick={() => void openStudyRoom(task)}><ActionIcon name="play" /><span>Do it now</span></button>
                    {editingTaskId !== task._id && <button className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => { setEditingTitle(task.title); setEditingTaskId(task._id); }}><ActionIcon name="edit" /></button>}
                    <button className="icon-button danger-icon" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => void deleteTask(task)}><ActionIcon name="delete" /></button>
                  </div>
                </article>)}
              </div>
              <form className="add-task add-task-bottom" onSubmit={addTask}>
                <input aria-label="New task title" placeholder="Add a task…" value={newTask} onChange={event => setNewTask(event.target.value)} maxLength={200} />
                <button type="submit" disabled={saving || !newTask.trim()}>＋ &nbsp;Add task</button>
              </form>
              <p className="list-hint">Select a task title to open its details.</p>
            </section>
            <ShareRecap key={user.id} generateRecap={generateDailyRecap} />
          </>
        ) : (
          <section className="auth-card">
            <h1>{mode === "register" ? "Make yourself at home." : "Welcome back."}</h1>
            <p className="subheading">{mode === "register" ? "Choose a username and password to get started." : "Sign in to pick up where you left off."}</p>
            <form className="auth-form" onSubmit={submitAuth}>
              <label>Username<input autoComplete="username" value={nickname} onChange={event => setNickname(event.target.value)} minLength={2} maxLength={40} required /></label>
              <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === "register" ? 8 : undefined} maxLength={128} required /></label>
              {mode === "register" && <p className="form-hint">Use at least 8 characters for your password.</p>}
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Please wait…" : mode === "register" ? "Create account" : "Log in"}</button>
            </form>
            <p className="auth-switch">{mode === "register" ? "Already have an account?" : "New here?"} <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Log in" : "Create an account"}</button></p>
          </section>
        )}
      </section>
    </main>
  );
}
