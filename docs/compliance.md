# On-call review rules and sources

Checked 9 November 2026. These checks prompt an operator review. They do not certify legal compliance, measure actual hours worked, establish fitness for duty or send alerts.

| Rule | Meaning | Implementation |
| --- | --- | --- |
| NZ-IPP9 | [NZ Privacy Principle 9](https://www.privacy.org.nz/privacy-principles/9/) limits keeping personal information beyond its lawful purpose | Flags overdue responder retention reviews; nothing is deleted automatically |
| LOCAL-FATIGUE | [WorkSafe fatigue guidance](https://www.worksafe.govt.nz/topic-and-industry/fatigue/managing-the-risks-of-shift-work/) supports managing fatigue risk | Duty-load review compares unioned assignment hours with a configurable local threshold, 48 hours by default; this is not a statutory limit or actual working time |
| LOCAL-COVERAGE | Business policy, not legislation | Flags gaps at each configured escalation level and simultaneous duties across policy-level pairs |
| LOCAL-READINESS | Business policy, not legislation | Flags unverified future slots, missing policy owners, overdue policy reviews, handovers and actions |

Review dates and thresholds are chosen by your organisation. Imported people and assignments are not independently verified. A covered interval means an active responder has an assignment, not that they can be reached. Check employment agreements, rest arrangements and actual work separately. Operators must review the full collection of exports, original evidence, database backups, drafts and generated documents when reviewing retention. The tool cannot locate every copy.
