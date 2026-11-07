# Share image integration

Import the production component and data type from this module:

```tsx
import { ShareRecap, type DailyRecap } from "./features/share";

// recap is the selected day's summary and recorded totals, supplied by the host.
<ShareRecap recap={recap} />
```

`DailyRecap` uses the requested shape in `types.ts`. `date` is a calendar date
(`YYYY-MM-DD`), `journeyDay` is an integer starting at 99, the combined
`completedTasks` count is a non-negative integer, and `realWorkDurationMs` and
`virtualWorkDurationMs` are finite,
non-negative milliseconds. Displayed durations are floored to whole seconds;
virtual time is taken directly from the input, never recalculated from real time.

The Dashboard uses `<ShareRecap generateRecap={generateDailyRecap} />`. The
callback requests `POST /api/daily-recap` with the current local `date`, IANA
`timeZone`, and login token, returning `DailyRecap`. The component calls it only
from the **Share** handler, then renders the returned recap to PNG automatically.
Every Share click requests a new recap. In-flight clicks are ignored. There is
no second generation button or model call on mount or prop changes.
The `recap` prop remains available for standalone use; provide either `recap`
or `generateRecap`, not both. The component itself does not fetch records.
**Save** downloads exactly the previewed PNG as `be-yourself-YYYY-MM-DD.png`.
Changing the input hides a stale preview and disables Save until Share is pressed
again. Generation errors appear inline and can be retried with Share.

The image separates `AI RECAP / JUST FOR FUN`, `REAL RECORDS`, and accelerated
virtual work time. Health tasks contribute to the ordinary completed-task total,
without a separate label. The heading is `Day N of self-discipline`; N comes
from the backend's registration-based journey calculation. Summary text never
supplies or modifies the statistical values or the journey day.
The image is 1080 pixels wide; height expands for the summary. Oversized summaries
that exceed the Canvas size guard show an error rather than being silently clipped.
Styles are scoped to `.by-share`; no global stylesheet changes are needed.

## Independent local demo

Run the existing frontend development command, then open:

`/src/features/share/demo.html`

This development-only entry owns its fixture in `demo.tsx`. It is not imported by
`index.ts`, `App.tsx`, or `main.tsx`, and does not generate a PNG until Share is
pressed. Do not import `demo.tsx` into the main window.

## Verification

- Existing `npm run build` passes (TypeScript and Vite).
- Standalone demo also bundles with Vite.
- Real Chrome checks cover no generation on mount/prop changes, duplicate clicks,
  PNG signature and dimensions, exact counts and durations, separate labels,
  stale preview invalidation, URL cleanup, invalid dates/statistics, zero and
  fractional durations, long CJK/multiline/unbroken text, and oversized summaries.
- Desktop and 375px mobile previews visually inspected; no horizontal overflow.
- Native Save downloads a PNG whose SHA-256 matches the preview Blob.
- No backend, Gemini, or social-platform calls; no added dependencies.
