# On-call Coverage for Claude Code

Own the duty records behind the weekly on-call review. Responders, policies, assignments, coverage gaps and handovers live in one database. Keep your live paging service operating while you review and plan.

## Three ways to use it

- **Do it yourself:** free MIT source. Install it, import your prepared PagerDuty assignments and run the review.
- **We customise it:** Enterprise DNA maps your records and adds your fields, rules, connections and shared screens. One setup fee, then a retainer for ongoing work.
- **We run it for you:** installed, connected and operated through **Omni by Enterprise DNA**, for one setup fee then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=pagerduty&utm_medium=readme).

## Start with synthetic records

```bash
npm install
npm run demo
npm run oncall -- coverage
npm run oncall -- workload
npm run oncall -- compliance
npm run view
npm run docs
npm test
```

Node 20 or 22, Windows or Linux. PGlite runs locally with no database service. DATABASE_URL selects PostgreSQL. Claude Code, Codex, OpenCode or Cursor reads the same instructions and commands. Production setup and backup instructions: [operations](docs/operations.md).

## The weekly jobs

/coverage finds the exact gaps. /who-is-on checks handover boundaries. /conflicts finds concurrent duty. /workload unions assignment hours. /escalation-check shows the assigned people at each configured level, without sending anything. /weekly-review combines coverage, workload and attention. /draft-handover writes a private draft. /compliance applies [documented review rules](docs/compliance.md).

Every read supports --json. All mutations require --actor. Codes match exactly; names match case-insensitively, and partial ids work. Ambiguity lists candidates and exits 1. Time inputs require a timezone, and output is UTC. End instants are exclusive. Run help for the full command list and read the matching .claude/commands file for flags.

## Bring your history

```bash
npm run oncall -- import pagerduty --file=fixtures/pagerduty.json --source=example-org --from=2026-11-09T00:00:00Z --to=2026-11-11T00:00:00Z --actor="Your name" --dry-run
```

Use an authorised GET /oncalls JSON export with complete pagination metadata, then repeat without --dry-run. [Exact mapping, reconciliation and limits](docs/replace-pagerduty.md). No production credentials are needed to try the demo. The importer preserves original records and refuses changed duplicates. It does not create perpetual schedule rotations or import delivery configuration.

## Ten questions your own review answers

1. Where are the uncovered intervals at each escalation level?
2. Who is assigned at the exact handover boundary?
3. Which responder has simultaneous duties across policies?
4. How many unique on-call hours does each responder carry?
5. Which imported assignments still need verification?
6. Which policy has no named owner or an overdue review?
7. Which handover is late and who owns it?
8. Which responders have overdue retention reviews?
9. What changed when an assignment was revised?
10. How many records arrived in each import batch?

These are supported queries, not claims that PagerDuty lacks them. Your own review dates, handover evidence and thresholds extend the questions you can ask.

## Documents in your name

Edit brand.json for your business name, colours and logo. npm run docs produces duty plans and handover records. npm run view produces weekly readiness, roster and open-handover snapshots. They are private, escaped HTML files with no write buttons. /new-view adds another read-only view.

## Your first hour: ten things to ask for

1. Put our name on the duty plan.
2. Show the two-hour gap in the demo.
3. Explain the exact handover boundary.
4. Show who covers two policies at once.
5. Count each person's overlapping duty once.
6. Preview our exported assignments.
7. Set our actual expected escalation levels.
8. Set our local fatigue-review threshold.
9. Draft the handover with unresolved actions.
10. Add a tested region field and report with /customise.

## Boundaries and proof

This is an on-call planning and readiness database. No live alert ingestion, notification sending, mobile push, repeating rotation engine or public access is included. [Why there is no front end](docs/why-no-front-end.md). Coverage means assigned duty, not successful delivery. Duty hours are not actual working hours. Legal checks prompt review rather than certify compliance.

npm test exercises every CLI command using an isolated database, with interval boundaries, duplicate-hour handling, empty policy gaps, partial export refusal, import rollback, idempotency, audit, validation and escaped documents. The manual CI workflow covers Windows and Linux plus PostgreSQL; a configured workflow is not proof of a completed run.

[Research and selection evidence](docs/research.md). MIT. Not affiliated with PagerDuty or Anthropic. Hosting, agent usage and operation remain your costs.
