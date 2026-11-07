# be-yourself

An productivity app that lets you experience the joy of pretending to be productive. Plan your ideal life, accelerate virtual time, complete tiny tasks, and turn ordinary days into extraordinary achievements. Be productive, or just look productive. Embrace every day with joy. Be yourself.

## Why We Built This

In an age of rapidly advancing technology and ever-faster lives, it seems like everyone is busy.

Every day, we chase efficiency and success, hoping to become more disciplined along the way.

Open social media, and you'll see a life that looks like this:

Wake up at five sharp, go to Pilates, enjoy a beautifully prepared, nutritious breakfast, then read, study, and work out. Every day is perfectly scheduled. Life is healthy and productive, and it seems like everyone is constantly becoming a better version of themselves.

We envy that life, and we've made the same resolution countless times: Starting tomorrow, I'm going to be that person too!

But we all know that
sometimes, you just can't do it.

So, what now?

You need our app.

Here, everyone can experience the joy of self-discipline. Plan your ideal life, step into an immersive study room, watch virtual time fly by, break big goals into bite-sized tasks, and take on simple, healthy challenges every day.

You can even hand an ordinary day over to AI and let it turn every little thing you did into an epic tale of a life well lived.

Earn achievements, gain experience, upgrade your virtual world, and share your glorious accomplishments with friends.

After all, who says self-discipline has to be so serious?

Take it easy! Welcome to a world where everyone can pretend to have it all together.


在这个科技飞速发展、生活节奏越来越快的时代，每个人似乎都非常繁忙。

我们每天都在追求效率、追求成功，也希望自己能够变得更加自律。

打开社交媒体，你总能看到这样的生活：

早上五点准时起床，去做 Pilates，吃一顿精致的营养早餐，然后阅读、学习、健身。每天的日程安排得井井有条，生活健康、高效，仿佛每个人都在不断成为更好的自己。

我们都羡慕这样的生活，也都曾经无数次下定决心：从明天开始，我也要成为这样的人！

但我们都知道，
有时候，你就是做不到。

怎么办？

你需要我们的软件。

在这里，每个人都可以体验自律的快乐。你可以规划理想中的生活，进入沉浸式自习室，体验加速流逝的虚拟时间，把庞大的目标拆解成一个个小任务，每天完成简单的健康挑战。

你甚至可以把平凡的一天交给 AI，让它将你做过的每一件小事重新包装成一段精彩绝伦的人生传奇。

你可以获得成就、积累经验、升级自己的虚拟世界，还可以把自己的辉煌战绩分享给朋友。

毕竟，谁规定自律一定要那么严肃？

放轻松！欢迎来到一个人人都可以假装自律的世界。

## Features and status

The introduction above is the author's original writing. This guide describes the implemented app.

| Feature | Behavior |
| --- | --- |
| Accounts | Username/password registration and login; separate records for each user |
| Tasks | Create, edit, delete, manually complete, and open details with one click |
| Dashboard splitting | Click Split on any active or completed task to create smaller tasks directly in the Dashboard |
| Completion inheritance | Splitting a completed task creates completed tasks; splitting an active task creates active tasks |
| Task actions | Completed tasks retain Split, edit, and delete; Do it now appears only for active tasks |
| Scheduling | Optional Planned start and Planned finish, with expired unfinished tasks removed from the Dashboard |
| Daily tasks | Five tasks chosen from a pool of thirty, displayed as ordinary tasks without a special badge |
| Work timer | Start, pause, resume, temporarily return, stop, and change focus modes |
| Other activities | Add and remove daily notes for the next recap |
| Daily sharing | Share generates an AI recap and PNG preview; Save downloads the preview |
| Journey | Day 99 at registration, increasing by calendar date; active dates and streaks recorded separately |

## Local setup

### Requirements

- Node.js 22 or later and npm.
- Docker Desktop installed and running.
- A Gemini API key for AI splitting and sharing. Tasks and timers work without a key.

The commands below use PowerShell and `npm.cmd` to avoid the Windows `npm.ps1` execution-policy issue. On other systems, use `npm`.

### 1. Start MongoDB

From the repository root:

```powershell
docker compose up -d mongodb
docker compose ps
```

MongoDB is available only on `127.0.0.1:27017`. Compose keeps its data in a named volume.

### 2. Install and configure the backend

```powershell
cd backend
npm.cmd install
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Edit `backend/.env`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/be-yourself
GEMINI_API_KEY=your_key_here
```

Replace the placeholder with your own key, or leave it empty when not using AI. Preserve an existing `.env`. Restart the backend after changing environment variables.

The key stays on the backend and is excluded from Git. The backend uses only `gemini-3.5-flash-lite`, without automatic model fallback. Use a **Free Tier** project in Google AI Studio to avoid API charges. A model with a free tier can still incur charges on a Paid Tier project. Availability and quotas depend on the project shown in AI Studio.

### 3. Start the backend

In `backend`:

```powershell
npm.cmd run dev
```

The default API address is `http://127.0.0.1:3000`. Check `http://127.0.0.1:3000/api/health` for server and database status.

### 4. Start the frontend

In a separate terminal, from the repository root:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. If that port is occupied, use the address printed by Vite.

| Service | Default port | Purpose |
| --- | --- | --- |
| Vite frontend | 5173 | The page users open |
| Express backend | 3000 | API requests |
| MongoDB | 27017 | Persistent records |

Vite proxies `/api` requests to `http://127.0.0.1:3000`. Both frontend and backend must run during development.

### Build and stop

Run `npm.cmd run build` separately in `backend` and `frontend` to check types and create build output. After building the backend, `npm.cmd start` runs the compiled server; first stop any development server using the same port.

Press `Ctrl+C` in each terminal to stop the app. Run `docker compose down` from the root to stop MongoDB while retaining the named data volume.

## How to use the app

### Register and log in

1. Select **Create an account**.
2. Enter a Username of 2-40 characters and a password of 8-128 characters.
3. Registration opens the Dashboard. Use **Log in** on later visits.
4. Use **Log out** in the top bar to sign out.

Usernames are case-insensitive. Passwords are stored using individual salts and hashes. Each account owns its tasks, activities, work sessions, and active-day records.

### Manage tasks

- Enter a title in the form at the bottom of the task list and select **Add task**.
- Check a task to complete it. Uncheck it to make it active again, unless it has expired.
- Click its title once to open details.
- Use the edit icon for a quick title change: Enter saves and Escape cancels.
- Use the delete icon to remove that task. Its database record is retained as soft-deleted history.
- Details show the full description, status, creation time, planned times, completion time, work-session start/end records, and real/virtual work totals.
- Completed tasks show Split, edit, and delete, without Do it now.

The Dashboard shows titles, checkboxes, necessary deadline cues, and task actions. Detailed history is available in task details.

### Split any task directly on the Dashboard

**Splitting turns ordinary actions into many small, visible tasks. The results belong on the Dashboard.**

1. Click **Split** on an active or completed task.
2. AI generates small concrete actions, in English.
3. The server saves them immediately and the Dashboard displays them. There is no preview-and-save confirmation step.
4. Each generated task behaves like an ordinary task and has its own Split button, checkbox, edit/delete actions, and active-only Do it now action.
5. Splitting an active task creates active tasks for manual completion.
6. Splitting a completed task creates completed tasks automatically. These appear checked and contribute to completed-task counts and daily sharing.
7. A generated task can itself be split. A later deliberate split of the same task is also allowed; repeated clicks during one request are blocked.

For example, drinking water can become picking up a cup, pouring water, opening your mouth, and taking a sip. If drinking water was already completed, those generated tasks inherit completion.

The source task is retained, and generated records retain a link to it. Deleting a task removes that selected task; other visible tasks remain independently manageable. Completing generated tasks does not automatically complete their source. Completion inheritance when the user splits an already completed task is the explicit exception to manual task completion.

Original user-entered text is preserved. AI-generated titles are English; splitting does not translate or overwrite the source title or description.

### Set planned times

1. Open task details and select the edit icon.
2. Choose local dates and times for **Planned start** and **Planned finish**; either can be empty.
3. When both are set, finish must be later than start.
4. Save the changes. A short due-time cue appears in the Dashboard.

Planned start does not start the timer automatically. At planned finish, an unfinished task becomes **Expired** and leaves the Dashboard, while its history remains in the database. An open app refreshes at the next deadline; if closed, expiration is reconciled on the next request. Completed tasks do not expire merely because their deadline passes.

### Use the Work timer

1. Select **Do it now** on an active task.
2. Select **Start focus**.
3. Use **Pause** and **Resume** as needed.
4. **Back to tasks** pauses the session without ending it. Reopen the task timer to resume.
5. **End session & return** ends the session and updates the task's totals.

| Mode | Multiplier |
| --- | --- |
| Gentle Focus | 1x |
| Deep Focus | 10x |
| Super Focus | 100x |

Change modes during a running session. Each segment is settled at its own multiplier; existing time is never reset:

```text
Virtual Duration = sum(Real Duration of each segment * that segment's Multiplier)
```

Paused time is excluded. Real and virtual durations are stored separately. The timer displays virtual time; task details and recap images label actual and virtual Work time separately. Task totals update when a session ends; daily sharing reads that day's session segments, including elapsed running time. Timing never automatically completes a task.

### Daily tasks

Five daily tasks are drawn from a pool of thirty and added to the ordinary task list. Existing tasks for the day are reused on refresh. They have no special health label or DAILY 5 badge and use the same task actions and completion counts.

### Other activities

1. Expand **Other activities** in the recap section.
2. Enter something else you did today and select **Add**.
3. Use the removal button beside a note to delete it.
4. The next Share request includes the saved notes.

Each note supports up to 2,000 characters and belongs to the user's current local day. Loading, adding, or removing notes does not call AI or generate an image.

### Generate and save a daily recap

1. Click **Share** on the Dashboard.
2. The backend reads today's completed task records, work segments, saved activities, and journey day.
3. Gemini writes an exaggerated, humorous, positive recap in English.
4. The frontend automatically creates a PNG and displays its preview.
5. Click **Save** to download that exact preview.

The image prominently shows **Day N of self-discipline**. AI entertainment copy, factual statistics, and accelerated virtual time are displayed separately. The backend supplies N and all statistics; AI must not change the numbers or invent completed activities. A detailed task list must not be mistaken for repeated physical actions.

Nothing is generated before Share is clicked. Each deliberate click generates a fresh recap; in-flight duplicate clicks are blocked. Generated recaps and images are not stored in MongoDB. Saving downloads locally. Users choose where to post the image; the app has no social-platform integration or automatic publishing.

### Journey Day and activity history

- Registration day displays **Day 99**. Three calendar days later displays Day 102.
- This display advances by local calendar dates, independently of the active-day streak.
- Real registration time and active dates remain stored. Repeated activity on one date counts as one active day.
- Opening the signed-in app records activity. A visible app updates at local midnight, and returning to the page also checks the date.
- The recap uses the same journey-day calculation as the Dashboard.

## API and project layout

The frontend uses React, TypeScript, and Vite. The backend uses Node.js, Express, Mongoose, and the official `@google/genai` SDK.

```text
frontend/src/
  App.tsx                 Login, Dashboard, task details, task timer
  features/share/         Activity notes, preview, PNG rendering
  features/tasks/         Related split-task details
backend/src/
  auth/                   Password handling and authentication
  config/                 Database connection and index initialization
  models/                 Users, tasks, sessions, daily records
  routes/                 HTTP endpoints
  services/               Gemini, recaps, activity, task splitting
compose.yaml              Local MongoDB service
```

| Purpose | Endpoint |
| --- | --- |
| Register / log in | `POST /api/auth/register`, `POST /api/auth/login`, body `{nickname,password}`; the UI calls nickname Username |
| Current user / log out | `GET /api/auth/me`, `POST /api/auth/logout` |
| Dashboard | `GET /api/tasks?date=YYYY-MM-DD&timeZone=America%2FNew_York` |
| Create task | `POST /api/tasks` |
| Read / edit / delete | `GET`, `PATCH`, `DELETE /api/tasks/:taskId` |
| Set completion | `PATCH /api/tasks/:taskId/completion`, body `{completed:boolean}` |
| Split and save | `POST /api/tasks/:taskId/breakdown`, returns HTTP 201 with `{tasks:[...]}` |
| Related split tasks | `GET /api/tasks/:taskId/subtasks` |
| Work sessions | `/api/study-sessions`, including active, pause, resume, multiplier, and stop routes |
| Record active day | `POST /api/user-activity`, body `{date,timeZone}` |
| Activity notes | `GET`, `POST /api/daily-activities`; `DELETE /api/daily-activities/:activityId` |
| Daily recap | `POST /api/daily-recap`, body `{date,timeZone}` |
| General AI text | `POST /api/ai/generate`, body `{prompt}`, returns `{text}` |

Except registration, login, and the health endpoint, these routes require `Authorization: Bearer <session token>`. Dates use the user's local `YYYY-MM-DD`; timeZone uses an IANA name such as `America/New_York`. Adding a note takes `{date,timeZone,text}` and removing a note takes `{date,timeZone}`.

The database keeps detailed history while the Dashboard stays compact. `.env`, dependency directories, build output, and caches are excluded by `.gitignore`.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Page does not open | Keep Vite running and use the URL it prints |
| Page opens but requests fail | Keep the backend running; check `/api/health` |
| Database connection fails | Start Docker Desktop, check `docker compose ps` and MONGODB_URI |
| docker command is missing | Confirm Docker Desktop is installed and reopen the terminal to refresh PATH |
| PowerShell blocks npm.ps1 | Use `npm.cmd` |
| AI is unavailable | Check the backend key, network, AI Studio project status, and quota |
| Environment changes have no effect | Restart the backend |
