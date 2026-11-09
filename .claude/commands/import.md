# Import PagerDuty assignments

Read docs/replace-pagerduty.md. Require a complete authorised export, stable organisation source, explicit window and actor. Run `npm run oncall -- import pagerduty --file=<path> --source=<organisation> --from=<ISO timestamp> --to=<ISO timestamp> --actor="Your name" --dry-run --json`. Reconcile the preview, then repeat without --dry-run when the user requested the import. Review owners, actual expected levels and verification before relying on coverage. Never request or display access tokens.
