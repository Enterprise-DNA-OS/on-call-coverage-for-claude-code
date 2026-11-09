import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { migrate } from "./migrate.mjs";
import { execute, commands, instant, coverage } from "./oncall.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oncall-test-"));
process.env.DATA_DIR = path.join(dir, "db");
process.env.OUTPUT_DIR = dir;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
let db,
  checks = 0;
const seen = new Set();
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
async function run(c, ...args) {
  seen.add(c);
  return execute(db, [c, ...args]);
}
async function reject(args, re) {
  await assert.rejects(() => execute(db, args), re);
  checks++;
}
const base = "2026-11-09T00:00:00.000Z",
  end = "2026-11-11T00:00:00.000Z";
const win = [`--from=${base}`, `--to=${end}`];
const actor = "--actor=Test Operator";
function child(file, args = [], status = 0) {
  const p = spawnSync(process.execPath, [file, ...args], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    timeout: 120000,
  });
  eq(p.status, status);
  if (p.status !== status) throw Error(p.stderr);
  return p;
}
try {
  db = await getDb();
  if (db.mode === "postgres") {
    const existing = await db.query(
      "select tablename from pg_tables where schemaname='public'",
    );
    if (existing.length)
      throw Error(
        "TEST_DATABASE_URL must point to an empty disposable database",
      );
  }
  eq((await migrate(db)).ran.length, 1);
  eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(
    path.join(REPO_ROOT, "supabase/seed.sql"),
    "utf8",
  );
  await db.exec(seed);
  await db.exec(seed);
  eq((await db.query("select * from slots")).length, 5);
  // Pin demo slots to a fixed UTC day for deterministic edge tests.
  await db.exec(
    "update slots set starts_at='2026-11-09'::date+(starts_at::date-current_date)*interval '1 day'+(starts_at-current_date-(starts_at::date-current_date)*interval '1 day'), ends_at='2026-11-09'::date+(ends_at-current_date)",
  );
  eq((await run("help")).length, commands.length);
  for (const c of [
    "responders",
    "policies",
    "services",
    "roster",
    "handovers",
    "actions",
    "attention",
    "compliance",
    "weekly-review",
    "audit",
    "import-health",
  ])
    ok(Array.isArray(await run(c, ...win)));
  const gaps = (await run("coverage", ...win)).filter((r) => r.state === "GAP");
  eq(gaps.length, 4);
  eq(gaps.find((r) => r.policy === "Storefront").hours, 2);
  eq(gaps.find((r) => r.policy === "Data delivery" && r.level === 2).hours, 24);
  const load = await run("workload", ...win);
  eq(load.find((r) => r.code === "R-01").duty_hours, 36);
  const conflicts = await run("conflicts", ...win);
  eq(conflicts.length, 1);
  eq(conflicts[0].hours, 12);
  const at24 = await run("who-is-on", "--at=2026-11-10T00:00:00Z");
  eq(at24.find((r) => r.policy === "Storefront" && r.level === 1).state, "GAP");
  const at26 = await run("escalation-check", "--at=2026-11-10T02:00:00Z");
  eq(
    at26.find((r) => r.policy === "Storefront" && r.level === 1).responders,
    "R-02",
  );
  eq(instant("2026-11-09T13:00:00+13:00"), base);
  assert.throws(() => instant("2026-02-30T01:00:00Z"));
  checks++;
  assert.throws(() => instant("2026-11-09T01:00:00"));
  checks++;
  await reject(["coverage", "--from=" + end, "--to=" + base], /Window/);
  await reject(["coverage", "--form=" + base], /Unknown option/);
  await reject(
    [
      "add-slot",
      "--code=BAD",
      "--policy=P-01",
      "--responder=Sam",
      "--level=1",
      ...win,
      actor,
    ],
    /Ambiguous.*responders[\s\S]*R-03[\s\S]*R-04/,
  );
  await reject(
    [
      "add-action",
      "--code=BAD",
      "--name=bad",
      "--owner=owner",
      "--due=2026-02-30",
      actor,
    ],
    /real YYYY/,
  );
  await reject(
    ["add-responder", "--code=BAD", "--name=Bad", "--review-due=2027-01-01"],
    /actor/,
  );
  await run(
    "add-responder",
    "--code=R-X",
    "--name=<script>alert(1)</script>",
    "--review-due=2027-01-01",
    actor,
  );
  await run(
    "add-policy",
    "--code=P-X",
    "--name=Empty policy",
    "--owner=Alex",
    "--levels=2",
    "--review-due=2027-01-01",
    actor,
  );
  eq(
    (await run("coverage", ...win, "--policy=P-X")).filter(
      (r) => r.state === "GAP",
    ).length,
    2,
  );
  await run(
    "add-service",
    "--code=S-X",
    "--name=Example service",
    "--policy=Empty policy",
    actor,
  );
  await run(
    "add-slot",
    "--code=SHIFT-X",
    "--policy=P-X",
    "--responder=R-X",
    "--level=1",
    ...win,
    actor,
  );
  await run(
    "verify-slot",
    "--record=SHIFT-X",
    "--evidence=Checked source roster",
    actor,
  );
  eq(
    (await db.query("select verified from slots where code='SHIFT-X'"))[0]
      .verified,
    true,
  );
  await reject(
    [
      "add-slot",
      "--code=BAD",
      "--policy=P-X",
      "--responder=R-X",
      "--level=3",
      ...win,
      actor,
    ],
    /integer/,
  );
  await reject(
    [
      "add-slot",
      "--code=BAD",
      "--policy=P-X",
      "--responder=R-X",
      "--level=1",
      "--from=" + end,
      "--to=" + base,
      actor,
    ],
    /check constraint/,
  );
  await run(
    "revise-slot",
    "--record=SHIFT-X",
    "--from=2026-11-09T01:00:00Z",
    "--to=" + end,
    "--evidence=Approved time correction",
    actor,
  );
  eq(
    (await db.query("select verified from slots where code='SHIFT-X'"))[0]
      .verified,
    false,
  );
  ok(
    (await run("audit")).some(
      (r) =>
        r.operation === "slot-before-revision" &&
        r.evidence.includes("2026-11-09"),
    ),
  );
  await run(
    "review-policy",
    "--record=P-X",
    "--owner=Alex",
    "--levels=3",
    "--review-due=2027-02-01",
    "--evidence=Confirmed third level",
    actor,
  );
  eq(
    (await run("coverage", ...win, "--policy=P-X")).filter(
      (r) => r.level === 3 && r.state === "GAP",
    ).length,
    1,
  );
  await run(
    "review-responder",
    "--record=R-X",
    "--review-due=2027-02-01",
    "--active=false",
    "--evidence=No longer participating",
    actor,
  );
  eq(
    (await run("coverage", ...win, "--policy=P-X")).every(
      (r) => r.state === "GAP",
    ),
    true,
  );
  await run(
    "add-handover",
    "--code=H-X",
    "--policy=P-X",
    "--name=Test handover",
    "--owner=Alex",
    "--due=" + end,
    actor,
  );
  await run(
    "add-action",
    "--code=A-X",
    "--name=Find cover",
    "--owner=Alex",
    "--due=2026-11-10",
    actor,
  );
  await reject(
    ["complete", "--type=handovers", "--record=H-X", actor],
    /evidence/,
  );
  await run(
    "complete",
    "--type=handovers",
    "--record=H-X",
    "--evidence=Reviewed with next responder",
    actor,
  );
  await run(
    "complete",
    "--type=actions",
    "--record=A-X",
    "--evidence=Cover agreed",
    actor,
  );
  await run(
    "log",
    "--type=policies",
    "--record=P-X",
    "--evidence=Reviewed by operator",
    actor,
  );
  const fixture = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "fixtures/pagerduty.json"), "utf8"),
  );
  const file = path.join(dir, "input.json");
  const put = (v) => fs.writeFileSync(file, JSON.stringify(v));
  put(fixture);
  const imp = [
    "pagerduty",
    `--file=${file}`,
    "--source=test-org",
    ...win,
    actor,
  ];
  eq((await run("import", ...imp, "--dry-run"))[0].added, 1);
  eq((await db.query("select * from imports")).length, 0);
  eq((await run("import", ...imp))[0].added, 1);
  eq((await run("import", ...imp))[0].skipped, 1);
  const revised = structuredClone(fixture);
  revised.oncalls[0].user.summary = "Changed identity";
  put(revised);
  await reject(["import", ...imp], /Changed duplicate/);
  const rollback = structuredClone(revised);
  const fresh = structuredClone(fixture.oncalls[0]);
  fresh.user.id = 'ROLLBACK-USER';
  rollback.oncalls.unshift(fresh);
  put(rollback);
  const countBeforeRollback = (await db.query('select * from slots')).length;
  await reject(['import', ...imp], /Changed duplicate/);
  eq((await db.query('select * from slots')).length, countBeforeRollback);
  eq((await db.query("select * from responders where code='test-org:ROLLBACK-USER'")).length, 0);
  const incomplete = structuredClone(fixture);
  incomplete.more = true;
  put(incomplete);
  await reject(["import", ...imp], /Incomplete/);
  const bad = structuredClone(fixture);
  bad.oncalls.push({ ...bad.oncalls[0], start: "not a date" });
  put(bad);
  const before = (await db.query("select * from slots")).length;
  await reject(["import", ...imp], /ISO timestamp/);
  eq((await db.query("select * from slots")).length, before);
  const nulls = structuredClone(fixture);
  nulls.oncalls[0].user.id = "PU002";
  nulls.oncalls[0].start = null;
  nulls.oncalls[0].end = null;
  put(nulls);
  eq((await run("import", ...imp))[0].added, 1);
  const pages = [structuredClone(fixture), structuredClone(nulls)];
  pages[0].more = true;
  pages[1].offset = 25;
  put(pages);
  eq((await run("import", ...imp))[0].skipped, 2);
  pages[1].offset = 2;
  put(pages);
  await reject(["import", ...imp], /Incomplete/);
  const out = path.join(dir, "export.json");
  await run("export", `--file=${out}`);
  eq(JSON.parse(fs.readFileSync(out, "utf8")).format, "on-call-coverage-v1");
  await reject(["export", `--file=${out}`], /EEXIST/);
  const draft = (await run("draft-handover", "--policy=P-01", ...win))[0];
  ok(fs.readFileSync(draft.file, "utf8").includes("draft handover"));
  // Nested overlap and end-boundary arithmetic independently checked.
  const cc = {
    from: base,
    to: end,
    policies: [{ code: "P", name: "Policy", levels: 1 }],
    slots: [
      {
        policy_code: "P",
        level: 1,
        responder_code: "R",
        active: true,
        starts_at: base,
        ends_at: end,
      },
      {
        policy_code: "P",
        level: 1,
        responder_code: "R",
        active: true,
        starts_at: "2026-11-09T12:00:00Z",
        ends_at: "2026-11-10T00:00:00Z",
      },
    ],
  };
  eq(coverage(cc).length, 1);
  eq(coverage(cc)[0].hours, 48);
  await db.close();
  db = null;
  const cli = child("scripts/oncall.mjs", ["coverage", ...win, "--json"]);
  ok(Array.isArray(JSON.parse(cli.stdout)));
  const ambiguous = child(
    "scripts/oncall.mjs",
    ["log", "--type=responders", "--record=Sam", "--evidence=test", actor],
    1,
  );
  ok(ambiguous.stderr.includes("R-03"));
  child("scripts/view.mjs");
  child("scripts/docs.mjs");
  const roster = fs.readFileSync(
    path.join(dir, "views", "roster.html"),
    "utf8",
  );
  ok(roster.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  ok(!roster.includes("<script>alert(1)</script>"));
  ok(fs.readdirSync(path.join(dir, "docs-out", "duty-plan")).length >= 3);
  eq([...seen].sort(), commands.filter((c) => true).sort());
  console.log(
    `PASS: ${checks} assertions; all ${seen.size} CLI commands exercised; interval, import, audit and document checks`,
  );
} finally {
  await db?.close();
  if (!process.env.KEEP_TEST_DATA)
    fs.rmSync(dir, { recursive: true, force: true });
}
