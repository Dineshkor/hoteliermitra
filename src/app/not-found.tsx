import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page empty">
      <h1>Page not found</h1>
      <p>Let’s get you back to hospitality jobs.</p>
      <Link className="button primary" href="/jobs">
        Browse jobs
      </Link>
    </div>
  );
}
