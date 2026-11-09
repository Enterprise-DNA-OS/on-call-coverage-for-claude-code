# Bring PagerDuty on-call assignments across

This imports finite on-call assignments, not PagerDuty's live alert delivery. Keep paging operational throughout the change. A prepared export can be imported and reconciled in a day. Replacing live notification delivery needs a separate, tested implementation.

## Get the export

An authorised administrator retrieves GET /oncalls for an explicit since/until range, all required policy and user filters, with earliest=false. Save the full JSON response, including offset, limit, more and oncalls. When more is true, fetch every next page and save an array of the response objects in offset order. Do not supply tokens to this project or commit exports. This is an API export, not a claimed dashboard CSV button.

[PagerDuty's API schema](https://github.com/PagerDuty/api-schema/blob/main/reference/REST/openapiv3.json) documents the endpoint, parameters and Oncall records. [API concepts](https://docs.pagerduty.com/developer/api-concepts) explains the meaning of an on-call entry. Checked 9 November 2026. fixtures/pagerduty.json is synthetic data shaped after the documented response, not a real customer export.

## One import command

```bash
npm run oncall -- import pagerduty --file=fixtures/pagerduty.json --source=example-org --from=2026-11-09T00:00:00Z --to=2026-11-11T00:00:00Z --actor="Your name" --dry-run
```

Review the counts, repeat without --dry-run to save. Use the actual export query's from/to window, at most 31 days per import. Record source as a stable organisation identifier so different accounts never collide. Check source row counts, filters, first and last timestamps, and each policy's full expected levels. The importer validates pagination metadata but cannot prove your export query included every policy or person.

## Mapping and scope

user.id and escalation_policy.id become source-prefixed record codes. Their summary fields become names. escalation_level is the level; schedule.summary is a label. start and end become UTC instants, clipped to the declared export window. Null bounds for always-on assignments become the declared bounds. Entries outside the window and reversed intervals fail the whole batch. Calendar feeds are not accepted.

The identity is source, user, policy, schedule, level and clipped interval. Identical repeats are skipped. A changed original row with the same identity is refused for reconciliation. A changed interval creates another assignment; it does not replace old duty. Review and revise old slots before treating a refreshed export as current. The original row is retained as evidence. Imports are atomic, and preview rolls back every write.

Imported users start active, with retention review due today. Policies start without an owner, with a review due today and expected levels inferred only from rows present. Missing higher levels cannot be inferred: run review-policy to set the actual levels and owner. Imported slots start unverified and appear in the roster, but are flagged for review. Coverage is assignment coverage, not proof of readiness or successful notification.

No repeating schedule rules, overrides, time restrictions, escalation delays, repeat counts, services, contact methods, incidents, audit history or delivery configuration are imported. Assignment snapshots already reflect the vendor's computed schedule for the exported window. Add service links and handovers locally. A future export window is not a perpetual rotation.

## Reconcile before relying on it

1. Reconcile each exported page count using import-health and export.
2. Check policy levels, ownership and each responder's active state.
3. Check who-is-on at handover boundaries. Intervals include their start and exclude their end.
4. Run coverage, conflicts, workload and compliance over the same explicit window.
5. Verify assignment evidence and document the handover. Test alert delivery independently before changing any live paging arrangement.

Enterprise DNA maps your records, builds required integrations and screens, and runs your version through Omni by Enterprise DNA.
