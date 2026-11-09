# Actions

Run `npm run oncall -- actions --json`. For time-based reports, use the requested `--from=<ISO timezone timestamp>` and `--to=<ISO timezone timestamp>`; who-is-on and escalation-check use `--at=<ISO timezone timestamp>`. Coverage, roster and workload accept `--policy=<code>`. Compliance accepts `--max-hours=<local threshold>`.

Read the actual output, explain the next action, and preserve the explicit time window. All timestamps are UTC. No notifications are sent. Coverage is assignment coverage, not proof of delivery. Never invent data or state that a policy is legally compliant.
