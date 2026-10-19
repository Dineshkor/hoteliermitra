# HotelierMitra Rebrand

Date: 2026-10-19
Status: Approved

## Context

The app ships under the working brand "Hospitality Hire". The client has chosen the product name **HotelierMitra** ("mitra" = friend) with domain **hoteliermitra.com**. The brand appears in the header wordmark, footer, sign-in eyebrow, page titles/OG metadata, and the fallback URLs in `robots.ts`/`sitemap.ts`. No favicon exists today (browser tabs show the default).

## Decision

- **Wordmark:** keep the existing lowercase pattern `hospitality` + green accent `hire` + dot, now `hotelier` + green `mitra.` (`.brand-accent` and `.brand-dot` classes unchanged).
- **Mark:** replace the Lucide `ChefHat` with Lucide `Handshake` at the same size and stroke width (24 / 1.6). "Friend/partner" matches the product promise to hoteliers. `.brand-symbol` styling (green icon, inline flex) is unchanged.
- **Tagline:** unchanged — "Good people. Great hospitality."
- **Favicon:** new `src/app/icon.svg` (Next.js app-router icon convention, picked up automatically): 64×64 rounded square, fill `#264e3d` (the `--green` token), radius 14, white `Handshake` paths (exact Lucide 1.49.0 data below) translated by (14, 14) and scaled ×1.5, `fill="none"`, `stroke="#ffffff"`, `stroke-width="2"`, round caps/joins.
- **Default site URL:** `https://hoteliermitra.com` in `robots.ts` and `sitemap.ts`, still overridable with `NEXT_PUBLIC_SITE_URL`.

## Exact string changes

| Location | Current | New |
| --- | --- | --- |
| `src/components/shell.tsx` Brand wordmark | `hospitality` + accent `hire` + dot | `hotelier` + accent `mitra` + dot |
| `src/components/shell.tsx` aria-label | `Hospitality Hire home` | `HotelierMitra home` |
| `src/components/shell.tsx` footer | `© {year} Hospitality Hire` | `© {year} HotelierMitra` |
| `src/components/pages/login.tsx` eyebrow | `WELCOME TO HOSPITALITY HIRE` | `WELCOME TO HOTELIERMITRA` |
| `src/app/layout.tsx` default title | `Hospitality Hire · Good people. Great hospitality.` | `HotelierMitra · Good people. Great hospitality.` |
| `src/app/layout.tsx` title template | `%s | Hospitality Hire` | `%s | HotelierMitra` |
| `src/app/page.tsx` title + openGraph title | as default title (2 places) | as default title |
| `src/app/jobs/page.tsx` title | `Find Hospitality Jobs | Hospitality Hire` | `Find Hospitality Jobs | HotelierMitra` |
| `src/app/companies/[id]/page.tsx` title | `` `${company.name} | Hospitality Hire` `` | `` `${company.name} | HotelierMitra` `` |
| `src/app/login/page.tsx` description | `Sign in to your Hospitality Hire account.` | `Sign in to your HotelierMitra account.` |
| `src/app/robots.ts`, `src/app/sitemap.ts` | `https://hospitalityhire.in` | `https://hoteliermitra.com` |
| `scripts/smoke-http.mjs` brand regex | `/Hospitality Hire\|hospitalityhire\|hospitality/` | `/HotelierMitra\|hoteliermitra\|hospitality/` |
| `README.md` | `# Hospitality Hire`; "The working brand is replaceable." | `# HotelierMitra`; "The brand is HotelierMitra (hoteliermitra.com)." |
| `package.json` | `"name": "hospitality-hire"` | `"name": "hoteliermitra"` |

Favicon handshake path data (Lucide 1.49.0, ISC):

```
m11 17 2 2a1 1 0 1 0 3-3
m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4
m21 3 1 11h-2
M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3
M3 4h8
```

## Out of scope

- The internal localStorage demo key `hospitality-hire-demo-v2` (invisible to users; renaming would wipe demo state).
- Supabase Auth email templates (dashboard configuration, not repo).
- Domain registration/DNS (client action) and further logo assets (social, app icons) beyond this favicon.
- Job JSON-LD (contains no brand string).

## Verification

1. `npm test` (expect 68 passing), `npm run typecheck`, `npm run lint`, `npm run build` all pass.
2. Smoke suite (demo-mode build) 10/10 with the updated brand regex — the regex proves the new brand token renders on pages.
3. Manual visual check: header wordmark `hoteliermitra.` with handshake mark, footer `© HotelierMitra`, login eyebrow `WELCOME TO HOTELIERMITRA`, browser tab shows the green handshake favicon, and page titles read `… | HotelierMitra`.

## Acceptance criteria

- Every user-visible "Hospitality Hire" string is replaced by HotelierMitra per the table.
- Header mark is the handshake icon; favicon exists and renders in the tab.
- No behavioral, data, or API change; full suite and build pass.
