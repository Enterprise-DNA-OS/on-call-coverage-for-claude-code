# Add Policy

Read the affected records first. Use the requested values, not the examples below. Execute only the user's requested change, and supply the operator's name.

```bash
npm run oncall -- add-policy --code=P-NEW --name="Support" --owner="Alex" --levels=2 --review-due=2027-01-31 --actor="Your name" --json
```

Read the affected record back and report the result. Codes and names must resolve to one record. Evidence must describe what was actually checked. A revision resets slot verification. No notification is sent.
