# Why there is no front end

The database holds the duty assignments, handovers and review evidence. Talk to Claude Code, Codex, OpenCode or Cursor to read or change it through the CLI. npm run view makes private, read-only HTML snapshots; npm run docs makes the duty plan and handover records.

A live screen can show incoming alerts, support mobile push, offer drag-and-drop rotations and update many users at once. This base does none of those things. It has no notification delivery, scheduler daemon, mobile app, offline synchronisation, rotation generator or per-person login. It is useful for a trusted team's weekly coverage planning, reconciliation and handover paperwork. Enterprise DNA builds and operates required shared screens and connections before a live switch.

Timestamps require an explicit timezone and are shown in UTC. Exported assignments contain resolved instants. Future recurring schedules across daylight saving changes must be calculated by the source system or a separately tested schedule implementation.
