# Be Yourself — Project Proposal

## 1. Project Overview

**Be Yourself** is a lighthearted productivity app that helps people organize manageable tasks, spend focused time on them, and recognize small everyday wins. The product treats self-discipline with humor: it records real activity accurately while allowing users to enjoy an exaggerated, playful account of their day.

The project will build on the existing React + Vite frontend and Node.js + Express backend. The product requirements call for MongoDB persistence and server-side AI integration. These product features have not yet been implemented in the current starter scaffold.

## 2. Product Goals

- Make it quick to review and manage tasks from a simple Dashboard.
- Provide a task timer that records real and accelerated virtual work time accurately.
- Keep task completion and daily sharing under the user's control.
- Preserve useful history without crowding the main screen.
- Turn an ordinary day into a playful, saveable recap when the user chooses to share.

## 3. Proposed Feature Scope

### 3.1 Task Dashboard and Task Details

The Dashboard will show each active task's title, a manual completion checkbox, and a deadline cue when relevant. It will avoid showing detailed metadata by default.

Users will be able to create and manage tasks. Opening a task will show its description, creation date, deadline, status, real and virtual work time, work sessions, subtasks, and related history. Overdue unfinished tasks will leave the active list while remaining in historical records.

Tasks are completed manually, except that splitting an already completed task creates completed tasks. Starting or ending a task timer session never completes a task automatically.

### 3.2 Task Timer and Time Acceleration

Each work session is associated with a task. The timer will support start, pause, resume, and stop, and will calculate elapsed time from timestamps so that refreshes or background tabs do not corrupt the record.

The available focus modes are **Gentle Focus (1x), Deep Focus (10x), and Super Focus (100x)**. Users may change modes while studying. The system will settle the elapsed time at the old speed before applying the new speed, and will keep real and virtual duration separate:

> Virtual duration = sum of (real duration in each segment × that segment's multiplier)

Only time spent in a running session is counted. Paused time and time spent merely inside the Study Room are excluded.

### 3.3 Daily Health Challenges and Activity Records

Five daily health challenges are added as ordinary tasks. They use the same presentation as other tasks, without a separate badge or category label. Users mark them complete manually. They are included in the combined completed-task count in daily sharing. The system will also let users record other daily activities. Task status and activity records will be retained by date.

### 3.4 User-Initiated AI Daily Recap and Share Image

The recap and sharing flow is one feature, initiated only by the user pressing **Share**. At that moment, the app will gather that day's completed tasks, completed health challenges, study records and time totals, and user-entered activities. AI will turn those facts into an exaggerated, humorous, positive recap.

The app will create a polished image containing the recap, combined completed-task count, and real and virtual work time, then show a preview with a **Save** action. The image will prominently state **Day N of self-discipline**, using the same Day 99 starting value and date-based progression as the Dashboard. This day value is computed by the backend, not invented by AI. The entertainment copy will be visually distinct from factual figures, and AI wording will not change the underlying numbers.

The app will not generate a recap or image before Share is pressed. It will not integrate with social platform APIs or publish automatically; users decide whether and where to post the saved image.

### 3.5 Journey Day and User History

Each user's records will be stored independently. The database will retain the actual registration date, completed-task dates, daily activities, health challenge results, study time, and active dates. The initial Journey Day display will be Day 99, while stored registration and activity dates remain real. Subsequent display values will follow the agreed date-based rule.

### 3.6 Task Breakdown

Every active or completed Dashboard task has a **Split** button. Clicking it generates tiny concrete actions, saves them immediately, and displays them as ordinary Dashboard tasks. Generated tasks can also be split. An active source produces active tasks; a completed source produces completed tasks that contribute to completion counts. Completed tasks keep Split, edit, and delete actions, without **Do it now**. The source remains available and each generated record retains its source link. Generated titles are English; user-authored content is preserved. There is no separate review-and-save step.

## 4. Development Plan

### Phase 1 — Data Model and API Foundation

- Define user, task, subtask, study session, daily activity, challenge, and activity-date records.
- Add MongoDB persistence and associate each record with its user.
- Establish and validate the REST API needed by the defined product flows.
- Keep AI credentials on the backend in environment variables.

**Deliverable:** Persistent data foundation and API contracts for the required features.

### Phase 2 — Dashboard and Task Management

- Implement the compact task list and task creation/editing/deletion flows.
- Add manual completion, deadline handling, and task details/history.
- Add the five daily health challenges and daily activity input.

**Deliverable:** Users can manage tasks and daily records while keeping the Dashboard uncluttered.

### Phase 3 — Study Room and Reliable Timer

- Implement session start, pause, resume, and stop.
- Support all four speed settings and live multiplier changes.
- Persist timer state and calculate real and virtual durations by timestamp and segment.

**Deliverable:** Task-linked study sessions with reliable real and virtual time records.

### Phase 4 — AI Flows and Share Image

- Implement Dashboard-triggered AI splitting with immediate persistence, visible generated tasks, and inherited completion state.
- Implement the Share-triggered daily recap and image generation.
- Add image preview and local save, with factual figures separated from playful copy.

**Deliverable:** The requested AI features, with sharing remaining entirely user-initiated.

### Phase 5 — Journey Day, History, and Integration

- Apply the Day 99 initial display rule and date-based progression.
- Connect Dashboard, task details, timer, daily records, and share generation to persisted user data.
- Review the flows against the product rules and correct integration gaps.

**Deliverable:** A coherent app with user-isolated history and the agreed end-to-end flows.

## 5. Technical Approach

- **Frontend:** React, TypeScript, and Vite (existing project setup).
- **Backend:** Node.js, Express, and TypeScript (existing project setup).
- **Database:** MongoDB, as specified by the product requirements.
- **Communication:** REST endpoints between frontend and backend.
- **AI:** Backend-only API calls for task breakdown and Share-triggered recap generation; secrets remain in environment variables.
- **Image:** Generate the recap image from the returned copy and actual daily data, with a browser preview and local save.

## 6. Product Rules and Out-of-Scope Work

- Tasks are completed manually, except that tasks created by splitting an already completed task inherit its completed state.
- Study sessions record time; they do not change task completion state.
- Real and virtual time are stored separately, including across multiplier changes.
- Detailed task history is available on demand, not shown by default on the Dashboard.
- No recap or image is generated until the user presses Share.
- No automatic publishing or third-party social platform API integration is included.
- No additional product modules or features will be added beyond the agreed requirements without approval.

## 7. Current Starting Point

The repository currently contains the frontend and backend scaffold, MongoDB models and connection setup, nickname/password registration and login endpoints, basic authenticated task endpoints, and a health endpoint. The Dashboard interface, user-facing login flow, study timer, AI flows, and recap image generation remain to be implemented according to the plan above.
