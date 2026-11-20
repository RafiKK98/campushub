import { useEffect, useState } from 'react';
import './App.css';

type HealthState = 'loading' | 'ok' | 'error';

type HealthResponse = {
  data: {
    status: string;
    service: string;
  };
};

function App() {
  const [health, setHealth] = useState<HealthState>('loading');

  useEffect(() => {
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health', { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}.`);
        }

        const payload = (await response.json()) as HealthResponse;
        setHealth(payload.data.status === 'ok' ? 'ok' : 'error');
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setHealth('error');
      }
    };

    void checkHealth();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="app-shell">
      <p className="eyebrow">CampusHub</p>
      <h1>Student portal foundation</h1>
      <p className="intro">
        This is the Milestone 0 application skeleton. Authentication, courses, enrollments,
        assignments, grading, and announcements are added in later milestones.
      </p>
      <p className={`status status-${health}`} role="status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        API health: {health}
      </p>
    </main>
  );
}

export default App;
