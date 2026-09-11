# Build-Tech Pro

The ERP of Build-Tech Protection Materials (Dubai) and Build-Tech Pro B.V. (Bruges):
clients, visits, pipeline, quotations, projects, purchase orders, shipments, stock,
invoices, payments, partners and payroll, in one file.

- `index.html` is the whole application (React through `htm`, no build step); the other
  files in the root are what the site serves. `config.js` points at the live database.
- `migrations/` holds the numbered database changes, applied in order.
- `tests/` is the test harness: per-fix browser checks, the end-to-end journeys and the
  scope-reader fixture, all against a separate test database (`tests/README.md`).
- `docs/` is the review of September 2026: the map, the schema and security audits, the
  findings, the refresh investigation, and the report for the owners (`docs/AUDIT-REPORT.md`).
- `DEPLOY.md` says how a push to `main` reaches the live database and the site.
