# Operating the duty database

Use Node 20 or 22. npm install, npm run demo, then npm run oncall -- help. With no DATABASE_URL, PGlite stores records under .data/db. DATABASE_URL selects PostgreSQL. Use a dedicated database and trusted owner connection. Public roles have no table access; there is no application login or tenant isolation.

Back up the database with your normal PostgreSQL tooling, or close all PGlite processes and copy its complete data directory. Test restoring into a separate directory or database before use. export produces a non-overwriting JSON evidence archive, not a restorable database backup. No backup command sends data anywhere.

Production records, drafts, reports and exports stay out of git. Protect filesystem access, encrypt storage and backups, and restrict database credentials. Never put credentials in command examples or export files. Generated HTML is private evidence, not a public website. All modifications require --actor and record an audit entry; the name is a supplied label, not authenticated identity. Database administrators can change the audit table, so it is not tamper-proof.

Slots are start-inclusive and end-exclusive. Coverage reports every configured policy level, including policies with no assignments. A responder marked inactive contributes no coverage. Workload unions overlapping intervals for each person rather than counting duplicate hours. Conflicts mean one person covering more than one distinct policy-level pair concurrently; multiple responders at one level can be intentional. No escalation delivery is simulated beyond showing who is assigned at each level at a single instant.

To replace an assignment, use revise-slot with its code, new --from and --to and evidence, then verify-slot after checking. Revision stores the previous record in audit and resets verification. review-policy sets owner, expected levels and review date. review-responder sets retention review date and optional --active=true or false. Completed handovers and actions require evidence. log records notes against a known record.

Default report window: UTC midnight today through seven days later. Use --from and --to for reproducible reports. Maximum window is 31 days. Static HTML reports show the database records; the CLI calculates exact gaps and workload. No claim is made about missing records beyond what was imported.
