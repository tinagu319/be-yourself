import { FormEvent, useEffect, useState } from "react";

type User = { id: string; nickname: string; registeredAt: string };
type Task = {
  _id: string;
  title: string;
  description: string;
  taskType: "personal" | "health-challenge";
  deadline: string | null;
  status: "active" | "completed" | "expired";
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

const TOKEN_KEY = "be-yourself-session-token";

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

async function readResponse<T>(response: Response): Promise<T> {
  const body = (response.status === 204 ? {} : await response.json()) as T & ApiError;
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [newTask, setNewTask] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [studyTask, setStudyTask] = useState<Task | null>(null);
  const [studySession, setStudySession] = useState<StudySession | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studySession || studySession.status !== "running") return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [studySession?.status]);

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
        setError(reason instanceof Error ? reason.message : "Could not restore your session.");
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
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
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
      setError(reason instanceof Error ? reason.message : "Could not add the task.");
    } finally {
      setSaving(false);
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
      if (body.task) setTasks(current => current.map(item => item._id === task._id ? body.task! : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the task.");
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
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the task.");
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
      if (selectedTaskId === task._id) setSelectedTaskId(null);
      if (studyTask?._id === task._id) {
        setStudyTask(null);
        setStudySession(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the task.");
    }
  };

  const openStudyRoom = async (task: Task) => {
    if (!token) return;
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
      setMultiplier(session?.segments.at(-1)?.multiplier ?? 1);
      setTimerNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the Study Room.");
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
        setTimerNow(Date.now());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the study session.");
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
      if (body.session) setStudySession(body.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not pause the study session.");
    }
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
      setError(reason instanceof Error ? reason.message : "Could not change the time speed.");
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
      setError(reason instanceof Error ? reason.message : "Could not save the study session.");
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
    setError("");
  };

  const activeSegment = studySession?.segments.at(-1);
  const segmentElapsed = studySession?.status === "running" && activeSegment && !activeSegment.endedAt
    ? Math.max(0, timerNow - new Date(activeSegment.startedAt).getTime())
    : 0;
  const realTimeMs = (studySession?.realDurationMs ?? 0) + segmentElapsed;
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
            <button className="back-button" onClick={() => { setStudyTask(null); setStudySession(null); }}>← &nbsp; Back to tasks</button>
            <div className="room-heading"><p className="eyebrow">STUDY ROOM</p><h1>{studyTask.title}</h1><p className="subheading">A focused session, at your pace. This will not complete the task.</p></div>
            <div className="room-timer">
              <div><span>REAL TIME</span><strong>{formatTimer(realTimeMs)}</strong></div>
              <span className="time-arrow">→</span>
              <div><span>VIRTUAL TIME</span><strong className="virtual-time">{formatTimer(virtualTimeMs)}</strong></div>
            </div>
            <div className="room-speed"><span>TIME SPEED</span>{[1, 10, 20, 100].map(value => <button key={value} className={multiplier === value ? "selected" : ""} onClick={() => void changeMultiplier(value)}>{value}×</button>)}</div>
            <div className="room-controls">
              {!studySession && <button className="primary-button" onClick={() => void startOrResumeStudy()}>Start focus</button>}
              {studySession?.status === "paused" && <button className="primary-button" onClick={() => void startOrResumeStudy()}>Resume</button>}
              {studySession?.status === "running" && <button className="pause-button" onClick={() => void pauseStudy()}>Pause</button>}
              {studySession && <button className="end-button" onClick={() => void endStudy()}>End session & return</button>}
            </div>
            <p className="room-note">Real and virtual time are recorded separately. Completing the task is always your choice.</p>
          </section>
        ) : (
          <>
            <div className="welcome-row">
              <div><p className="eyebrow">YOUR SPACE · {localDateKey()}</p><h1>Your day, your pace.</h1><p className="subheading">A little progress is still progress.</p></div>
              <div className="day-mark"><span>JOURNEY</span><strong>DAY {journeyDay(user.registeredAt)}</strong></div>
            </div>
            <section className="panel tasks-panel">
              <div className="panel-head"><div><p className="eyebrow">TODAY</p><h2>Tasks</h2></div><span className="quiet-label">{tasks.filter(task => task.status === "completed").length} done</span></div>
              <div className="task-list">
                {tasks.length === 0 && <p className="empty">Nothing on the list yet.</p>}
                {tasks.map(task => <article className={`task-row ${task.status === "completed" ? "is-done" : ""} ${selectedTaskId === task._id ? "is-selected" : ""}`} key={task._id}>
                  <input type="checkbox" checked={task.status === "completed"} onChange={event => void setTaskCompletion(task, event.target.checked)} aria-label={`Mark ${task.title} ${task.status === "completed" ? "incomplete" : "complete"}`} />
                  {editingTaskId === task._id ? <input className="edit-title" autoFocus value={editingTitle} maxLength={200} onChange={event => setEditingTitle(event.target.value)} onBlur={() => setEditingTaskId(null)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveTaskTitle(task, editingTitle); } if (event.key === "Escape") setEditingTaskId(null); }} aria-label="Edit task title" /> : <button className="task-title" onClick={() => setSelectedTaskId(task._id)} onDoubleClick={() => { setSelectedTaskId(task._id); setEditingTitle(task.title); setEditingTaskId(task._id); }} title="Click to select · double-click to edit">{task.title}</button>}
                  {task.taskType === "health-challenge" && <span className="task-badge">DAILY 5</span>}
                  {task.deadline && <span className="deadline">Due {new Date(task.deadline).toLocaleDateString()}</span>}
                  {selectedTaskId === task._id && task.status !== "completed" && <button className="doit-button" onClick={() => void openStudyRoom(task)}>Do it now</button>}
                  <button className="delete-button" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => void deleteTask(task)}>×</button>
                </article>)}
              </div>
              <form className="add-task add-task-bottom" onSubmit={addTask}>
                <input aria-label="New task title" placeholder="Add a task…" value={newTask} onChange={event => setNewTask(event.target.value)} maxLength={200} />
                <button type="submit" disabled={saving || !newTask.trim()}>＋ &nbsp;Add task</button>
              </form>
              <p className="list-hint">Click a task to select it. Double-click its title to edit.</p>
            </section>
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
