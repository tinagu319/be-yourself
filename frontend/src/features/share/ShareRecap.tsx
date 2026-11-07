import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDuration, renderRecap } from "./renderRecap";
import type { DailyRecap } from "./types";
import "./share.css";

type Preview = { url: string; recap: DailyRecap; key: string };
type ShareRecapProps = (
  | { recap: DailyRecap; generateRecap?: never }
  | { recap?: never; generateRecap: () => Promise<DailyRecap> }
) & { children?: ReactNode };

export function ShareRecap({ recap, generateRecap, children }: ShareRecapProps) {
  const key = recap ? JSON.stringify(recap) : "generated-recap";
  const latestKey = useRef(key);
  latestKey.current = key;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const objectUrl = useRef<string | null>(null);
  const visiblePreview = preview?.key === key ? preview : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  async function share() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setPreview(null);
    const requestedKey = key;
    try {
      const source = generateRecap ? await generateRecap() : recap!;
      if (!mounted.current || latestKey.current !== requestedKey) return;
      const snapshot: DailyRecap = { ...source, stats: { ...source.stats } };
      const blob = await renderRecap(snapshot);
      if (!mounted.current || latestKey.current !== requestedKey) return;
      const url = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      setPreview({ url, recap: snapshot, key: requestedKey });
    } catch (reason) {
      if (mounted.current && latestKey.current === requestedKey) {
        setError(reason instanceof Error ? reason.message : "Could not generate the image. Please try again.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function save() {
    if (!visiblePreview) return;
    const link = document.createElement("a");
    link.href = visiblePreview.url;
    link.download = `be-yourself-${visiblePreview.recap.date}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="by-share" aria-label="Daily recap share image" aria-busy={busy}>
      <div className="by-share__heading">
      <h2>Daily recap</h2>
      <div className="by-share__actions">
        <button type="button" onClick={() => void share()} disabled={busy}>{busy ? "Creating..." : "Share"}</button>
        {visiblePreview && <button className="by-share__save" type="button" onClick={save} disabled={busy}>Save</button>}
      </div>
      </div>
      {children}
      {error && <p className="by-share__error" role="alert">{error}</p>}
      {busy && <p className="by-share__note" role="status">Preparing your daily recap...</p>}
      {visiblePreview && <figure className="by-share__preview">
        <img src={visiblePreview.url} alt={`Day ${visiblePreview.recap.journeyDay} of self-discipline — ${visiblePreview.recap.date}`} />
        <figcaption>Day {visiblePreview.recap.journeyDay} of self-discipline · {visiblePreview.recap.date}. AI copy is for entertainment; virtual time is accelerated.</figcaption>
        <div className="by-share__sr-only">
          <p>AI recap, just for fun: {visiblePreview.recap.summary}</p>
          <dl>
            <dt>Completed tasks</dt><dd>{visiblePreview.recap.stats.completedTasks}</dd>
            <dt>Actual work time</dt><dd>{formatDuration(visiblePreview.recap.stats.realWorkDurationMs)}</dd>
            <dt>Virtual work time, accelerated, not actual elapsed time</dt><dd>{formatDuration(visiblePreview.recap.stats.virtualWorkDurationMs)}</dd>
          </dl>
        </div>
      </figure>}
    </section>
  );
}
