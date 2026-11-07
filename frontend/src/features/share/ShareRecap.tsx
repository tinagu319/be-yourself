import { useEffect, useRef, useState } from "react";
import { formatDuration, renderRecap } from "./renderRecap";
import type { DailyRecap } from "./types";
import "./share.css";

type Preview = { url: string; recap: DailyRecap; key: string };

export function ShareRecap({ recap }: { recap: DailyRecap }) {
  const key = JSON.stringify(recap);
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
    const snapshot: DailyRecap = { ...recap, stats: { ...recap.stats } };
    const requestedKey = key;
    try {
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
      <p className="by-share__eyebrow">YOUR DAY, WORTH CELEBRATING</p>
      <h2>A small day. A great story.</h2>
      <p className="by-share__intro">A keepsake of your day, with playful AI storytelling and clearly labeled real records.</p>
      <div className="by-share__actions">
        <button type="button" onClick={() => void share()} disabled={busy}>{busy ? "Creating image..." : "Share"}</button>
        <button className="by-share__save" type="button" onClick={save} disabled={!visiblePreview || busy}>Save</button>
      </div>
      {error && <p className="by-share__error" role="alert">{error}</p>}
      <p className="by-share__note" role="status">{busy ? "Preparing your PNG..." : visiblePreview ? "Preview ready. Save downloads this image as a PNG." : "Press Share to create your image. Nothing is posted automatically."}</p>
      {visiblePreview && <figure className="by-share__preview">
        <img src={visiblePreview.url} alt={`Be Yourself daily recap for ${visiblePreview.recap.date}`} />
        <figcaption>Daily recap for {visiblePreview.recap.date}. AI copy is for entertainment; virtual time is accelerated.</figcaption>
        <div className="by-share__sr-only">
          <p>AI recap, just for fun: {visiblePreview.recap.summary}</p>
          <dl>
            <dt>Completed tasks</dt><dd>{visiblePreview.recap.stats.completedTasks}</dd>
            <dt>Health challenges completed</dt><dd>{visiblePreview.recap.stats.completedHealthTasks}</dd>
            <dt>Actual study time</dt><dd>{formatDuration(visiblePreview.recap.stats.realStudyDurationMs)}</dd>
            <dt>Virtual study time, accelerated, not actual elapsed time</dt><dd>{formatDuration(visiblePreview.recap.stats.virtualStudyDurationMs)}</dd>
          </dl>
        </div>
      </figure>}
    </section>
  );
}
