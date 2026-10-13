"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container page">
      <div className="empty">
        <h3>Something went wrong</h3>
        <p className="muted">{error.message || "An unexpected error occurred in the employer workspace."}</p>
        <button className="button primary" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
