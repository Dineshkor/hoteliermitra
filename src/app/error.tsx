"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page empty">
      <h1>We couldn’t load this page.</h1>
      <p>Your saved information is still in place. Please try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
