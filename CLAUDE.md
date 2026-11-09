# On-call Coverage for Claude Code

A trusted operations team owns the duty database. Read README.md and docs/operations.md first. Use the matching .claude/commands recipe. One CLI, scripts/oncall.mjs, owns recurring reads and writes. Get facts from it before answering.

Run npm run demo for synthetic data, npm test for checks, npm run view for snapshots and npm run docs for paperwork. Start a Monday review with coverage, workload and attention. All read commands accept --json. Explicit report windows make comparisons reproducible.

Never send notifications, emails or messages. Draft only to drafts/. Never claim live paging is replaced. Do not edit production records without the user's request. For a write, supply the user's actor name and evidence, then read the result back. Never invent output. Do not read, print or commit credentials. Do not put real people or exports into source control.

Use source codes or unambiguous names; ambiguity must be resolved before a mutation. Timestamps need timezone offsets, reports use UTC, and intervals are end-exclusive. Check the actual expected escalation levels after import. A covered assignment may still be unverified.

Customisation: write a new numbered migration, update the CLI and tests, apply it, then demonstrate the change. Keep migrations working on PostgreSQL and PGlite. Do not build a front end; rendered views are read-only. Keep the shared template mechanics intact. Run the test suite before committing on main. Add the trailer Agent: omni-rebuild-strategist to authored commits.

Voice: specific, plain words, no em dashes or inflated claims. Database facts are not proof of legal compliance. Review sources in docs/compliance.md when rules change.
