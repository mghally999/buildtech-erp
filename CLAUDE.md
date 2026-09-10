# Build-Tech Pro

A single-file ERP for a UAE protective-coatings importer and applicator.
The entire application is `index.html` — ~13,800 lines, React via `htm` template
literals, no build step, no bundler, no JSX. Vendored libraries in `vendor/`.
Backend is Supabase; all authorisation lives in Postgres RLS, not the frontend.

## Non-negotiable rules
- Never point at the production Supabase project. Only the branch in `config.local.js`.
- No build step. No npm packages in the app. No JSX. Match the existing `htm` style exactly.
- Every record is scoped to an office (Dubai / Belgium). Never bypass office scoping.
- Never leave `console.log`, `debugger`, TODO markers, or commented-out code.
- Never invent a table or column. Verify against the live schema via the Supabase MCP.
- Money: EUR list → supply discount → AED conversion → margin → sell price. Do not alter
  this chain without being asked.
- Match the existing code's voice: plain-English comments explaining *why*, not *what*.
