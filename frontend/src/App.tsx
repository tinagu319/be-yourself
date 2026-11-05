import { useEffect, useState } from "react";

type ApiStatus = "checking" | "online" | "offline";

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
        setApiStatus("online");
      } catch {
        setApiStatus("offline");
      }
    };

    void checkApi();
  }, []);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">A LITTLE PROGRESS, A LITTLE PRETENDING</p>
        <h1>Be yourself.</h1>
        <p className="description">
          Build the life you aspire to, one tiny task at a time. No pressure to
          have it all together.
        </p>
        <div className={`status status--${apiStatus}`}>
          <span className="status__dot" />
          API {apiStatus}
        </div>
      </section>
    </main>
  );
}
