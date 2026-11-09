import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { table } from "./lib/format.mjs";
export const commands = [
  "help",
  "responders",
  "policies",
  "services",
  "roster",
  "who-is-on",
  "coverage",
  "workload",
  "conflicts",
  "escalation-check",
  "handovers",
  "actions",
  "attention",
  "compliance",
  "weekly-review",
  "audit",
  "import-health",
  "add-responder",
  "add-policy",
  "add-service",
  "add-slot",
  "add-handover",
  "add-action",
  "log",
  "verify-slot",
  "revise-slot",
  "review-policy",
  "review-responder",
  "complete",
  "import",
  "export",
  "draft-handover",
];
const entities = [
  "responders",
  "policies",
  "services",
  "slots",
  "handovers",
  "actions",
];
const iso = (v) => new Date(v).toISOString();
export function instant(v) {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      v,
    ) ||
    !Number.isFinite(Date.parse(v))
  )
    throw Error("Use an ISO timestamp with timezone");
  day(v.slice(0, 10));
  return iso(v);
}
function day(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || "") ||
    !Number.isFinite(Date.parse(v)) ||
    iso(v).slice(0, 10) !== v
  )
    throw Error("Use a real YYYY-MM-DD date");
  return v;
}
const stable = (v) =>
  JSON.stringify(
    Array.isArray(v)
      ? v.map((x) => JSON.parse(stable(x)))
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, JSON.parse(stable(v[k]))]),
          )
        : v,
  );
const hash = (v) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : JSON.stringify(v))
    .digest("hex");
const need = (o, k) => {
  if (o[k] === undefined || o[k] === true || !String(o[k]).trim())
    throw Error(`Missing --${k}=value`);
  return String(o[k]).trim();
};
function number(v, min, max) {
  if (!/^\d+$/.test(String(v)) || Number(v) < min || Number(v) > max)
    throw Error(`Expected integer ${min} to ${max}`);
  return Number(v);
}
export function parse(args) {
  const o = {},
    pos = [];
  for (const a of args) {
    if (a.startsWith("--")) {
      const i = a.indexOf("=");
      const k = a.slice(2, i < 0 ? undefined : i);
      if (k in o) throw Error(`Repeated --${k}`);
      o[k] = i < 0 ? true : a.slice(i + 1);
    } else pos.push(a);
  }
  return { o, pos };
}
function window(o) {
  const from = instant(
    o.from || new Date().toISOString().slice(0, 10) + "T00:00:00Z",
  );
  const to = instant(o.to || iso(Date.parse(from) + 7 * 86400000));
  if (
    Date.parse(to) <= Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 31 * 86400000
  )
    throw Error("Window must be positive and at most 31 days");
  return { from, to };
}
export async function match(db, t, q) {
  if (!entities.includes(t)) throw Error("Unknown record type");
  if (!q) throw Error("Record name, code or id required");
  const rows = await db.query(
    `select id,code,${t === "slots" ? "code as name" : "name"} from ${t} order by code`,
  );
  let hit = rows.filter(
    (r) => r.id === q || r.code.toLowerCase() === q.toLowerCase(),
  );
  if (!hit.length)
    hit = rows.filter(
      (r) =>
        r.id.startsWith(q.toLowerCase()) ||
        r.name.toLowerCase().includes(q.toLowerCase()),
    );
  if (hit.length !== 1)
    throw Error(
      `${hit.length ? "Ambiguous" : "Not found"} ${t}: ${q}\n${(hit.length ? hit : rows).map((r) => `${r.code} ${r.name} ${r.id}`).join("\n")}`,
    );
  return hit[0];
}
const audit = (db, o, operation, record, evidence = "") =>
  db.query(
    "insert into audit(actor,operation,record,evidence) values($1,$2,$3,$4)",
    [need(o, "actor"), operation, record, evidence],
  );
async function transact(db, fn, dry = false) {
  await db.exec("BEGIN");
  try {
    const result = await fn();
    await db.exec(dry ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
async function context(db, o) {
  const w = window(o);
  let policies = await db.query("select * from policies order by code");
  if (o.policy) {
    const p = await match(db, "policies", o.policy);
    policies = policies.filter((x) => x.id === p.id);
  }
  const slots = await db.query(
    "select * from v_roster where starts_at<$2 and ends_at>$1 order by starts_at,code",
    [w.from, w.to],
  );
  return {
    ...w,
    policies,
    slots: slots.filter((s) => policies.some((p) => p.code === s.policy_code)),
  };
}
function points(slots, from, to) {
  const a = Date.parse(from),
    b = Date.parse(to);
  return [
    ...new Set([
      a,
      b,
      ...slots.flatMap((s) => [
        Math.max(a, Date.parse(s.starts_at)),
        Math.min(b, Date.parse(s.ends_at)),
      ]),
    ]),
  ]
    .filter((x) => x >= a && x <= b)
    .sort((x, y) => x - y);
}
function segments(slots, from, to) {
  const p = points(slots, from, to);
  return p
    .slice(0, -1)
    .map((a, i) => ({
      a,
      b: p[i + 1],
      slots: slots.filter(
        (s) =>
          s.active && Date.parse(s.starts_at) <= a && Date.parse(s.ends_at) > a,
      ),
    }));
}
function mergeIntervals(rows, key) {
  const out = [];
  for (const r of rows) {
    const prev = out.at(-1);
    if (prev && key(prev) === key(r) && prev.to === r.from) {
      prev.to = r.to;
      prev.hours = +(prev.hours + r.hours).toFixed(4);
    } else out.push({ ...r });
  }
  return out;
}
export function coverage(c) {
  const out = [];
  for (const p of c.policies) {
    for (let level = 1; level <= p.levels; level++) {
      const slots = c.slots.filter(
        (s) => s.policy_code === p.code && s.level === level,
      );
      const rows = segments(slots, c.from, c.to).map((s) => ({
        policy: p.name,
        level,
        from: iso(s.a),
        to: iso(s.b),
        hours: (s.b - s.a) / 3600000,
        responders: [...new Set(s.slots.map((x) => x.responder_code))]
          .sort()
          .join(", "),
        state: s.slots.length ? "covered" : "GAP",
      }));
      out.push(
        ...mergeIntervals(
          rows,
          (r) => r.policy + "|" + r.level + "|" + r.responders,
        ),
      );
    }
  }
  return out;
}
function workload(c) {
  const out = [];
  for (const code of [...new Set(c.slots.map((s) => s.responder_code))]) {
    const slots = c.slots.filter((s) => s.responder_code === code);
    const hours = segments(slots, c.from, c.to)
      .filter((s) => s.slots.length)
      .reduce((a, s) => a + (s.b - s.a) / 3600000, 0);
    out.push({
      responder: slots[0].responder,
      code,
      duty_hours: +hours.toFixed(2),
      assignments: slots.length,
    });
  }
  return out.sort(
    (a, b) => b.duty_hours - a.duty_hours || a.code.localeCompare(b.code),
  );
}
function conflicts(c) {
  const out = [];
  for (const code of [...new Set(c.slots.map((s) => s.responder_code))]) {
    const slots = c.slots.filter((s) => s.responder_code === code);
    const rows = segments(slots, c.from, c.to)
      .filter(
        (s) =>
          new Set(s.slots.map((x) => x.policy_code + "#" + x.level)).size > 1,
      )
      .map((s) => ({
        responder: slots[0].responder,
        from: iso(s.a),
        to: iso(s.b),
        hours: (s.b - s.a) / 3600000,
        duties: [...new Set(s.slots.map((x) => x.policy_code + " L" + x.level))]
          .sort()
          .join(", "),
      }));
    out.push(...mergeIntervals(rows, (r) => r.responder + "|" + r.duties));
  }
  return out;
}
async function compliance(db, o) {
  const findings = (
    await db.query("select * from v_attention order by reason,code")
  ).map((r) => ({
    ...r,
    rule: r.reason === "retention-review" ? "NZ-IPP9" : "LOCAL-READINESS",
  }));
  const c = await context(db, o);
  for (const r of coverage(c).filter((r) => r.state === "GAP"))
    findings.push({
      reason: "coverage-gap",
      code: r.policy,
      name: `Level ${r.level}`,
      owner: "",
      due: r.from,
      rule: "LOCAL-COVERAGE",
    });
  const limit = number(o["max-hours"] || 48, 1, 744);
  for (const r of workload(c).filter((r) => r.duty_hours > limit))
    findings.push({
      reason: "duty-load-review",
      code: r.code,
      name: `${r.duty_hours} on-call hours exceeds local review threshold ${limit}`,
      owner: r.responder,
      due: c.to,
      rule: "LOCAL-FATIGUE",
    });
  for (const r of conflicts(c))
    findings.push({
      reason: "concurrent-duty",
      code: r.duties,
      name: r.responder,
      owner: r.responder,
      due: r.from,
      rule: "LOCAL-COVERAGE",
    });
  return findings;
}
function paged(input) {
  const pages = Array.isArray(input) ? input : [input];
  if (!pages.length) throw Error("No export pages");
  let offset = 0;
  const rows = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (
      !Array.isArray(p.oncalls) ||
      p.offset !== offset ||
      p.more !== i < pages.length - 1
    )
      throw Error(
        "Incomplete or out-of-order export pages: require offset and more metadata",
      );
    if (
      p.more &&
      (!p.oncalls.length || !Number.isInteger(p.limit) || p.limit < 1)
    )
      throw Error("Invalid pagination");
    rows.push(...p.oncalls);
    offset += p.limit || p.oncalls.length;
  }
  return rows;
}
async function importPd(db, o, pos) {
  if (pos[1] !== "pagerduty") throw Error("Use import pagerduty");
  const source = need(o, "source");
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(source))
    throw Error("Source must be a short organisation identifier");
  const actor = need(o, "actor");
  const from = instant(need(o, "from")),
    to = instant(need(o, "to"));
  window({ from, to });
  const raw = fs.readFileSync(need(o, "file"), "utf8");
  const rows = paged(JSON.parse(raw));
  const mapped = rows.map((r, i) => {
    if (
      !r.user?.id ||
      !r.user?.summary ||
      !r.escalation_policy?.id ||
      !r.escalation_policy?.summary
    )
      throw Error(`Row ${i + 1}: user and policy references required`);
    const level = number(r.escalation_level, 1, 10);
    const a = r.start === null ? from : instant(r.start);
    const b = r.end === null ? to : instant(r.end);
    if (Date.parse(b) <= Date.parse(a))
      throw Error(`Row ${i + 1}: reversed interval`);
    const start = iso(Math.max(Date.parse(from), Date.parse(a))),
      end = iso(Math.min(Date.parse(to), Date.parse(b)));
    if (start >= end)
      throw Error(`Row ${i + 1}: outside requested export window`);
    return {
      r,
      level,
      start,
      end,
      code:
        "PD-" +
        hash([
          source,
          r.user.id,
          r.escalation_policy.id,
          r.schedule?.id || "direct",
          level,
          start,
          end,
        ]).slice(0, 24),
    };
  });
  const digest = hash([raw, from, to]);
  return transact(
    db,
    async () => {
      let added = 0,
        skipped = 0;
      for (const m of mapped) {
        const old = await db.query("select raw from slots where code=$1", [
          m.code,
        ]);
        if (old.length) {
          if (stable(old[0].raw) !== stable(m.r))
            throw Error("Changed duplicate needs reconciliation");
          skipped++;
          continue;
        }
        const ucode = `${source}:${m.r.user.id}`,
          pcode = `${source}:${m.r.escalation_policy.id}`;
        await db.query(
          "insert into responders(code,name,review_due) values($1,$2,current_date) on conflict(code) do nothing",
          [ucode, m.r.user.summary],
        );
        await db.query(
          "insert into policies(code,name,levels,review_due) values($1,$2,$3,current_date) on conflict(code) do update set levels=greatest(policies.levels,excluded.levels)",
          [pcode, m.r.escalation_policy.summary, m.level],
        );
        await db.query(
          "insert into slots(code,policy_id,responder_id,level,schedule,starts_at,ends_at,raw) select $1,p.id,u.id,$4,$5,$6,$7,$8::jsonb from policies p,responders u where p.code=$2 and u.code=$3",
          [
            m.code,
            pcode,
            ucode,
            m.level,
            m.r.schedule?.summary || "Direct assignment",
            m.start,
            m.end,
            JSON.stringify(m.r),
          ],
        );
        added++;
      }
      await db.query(
        "insert into imports(source,sha256,records,actor) values($1,$2,$3,$4) on conflict(source,sha256) do nothing",
        [source, digest, rows.length, actor],
      );
      await audit(
        db,
        o,
        "import",
        source,
        `${added} added, ${skipped} repeated; ${from} to ${to}`,
      );
      return [{ source, added, skipped, dry_run: !!o["dry-run"] }];
    },
    !!o["dry-run"],
  );
}
export async function execute(db, args) {
  const { o, pos } = parse(args);
  const cmd = pos[0] || "help";
  const allowed = new Set([
    "json",
    "from",
    "to",
    "at",
    "policy",
    "max-hours",
    "source",
    "actor",
    "file",
    "dry-run",
    "name",
    "code",
    "review-due",
    "owner",
    "levels",
    "responder",
    "level",
    "schedule",
    "due",
    "record",
    "evidence",
    "type",
    "active",
  ]);
  for (const k of Object.keys(o))
    if (!allowed.has(k)) throw Error("Unknown option --" + k);
  if (!commands.includes(cmd)) throw Error(`Unknown command: ${cmd}`);
  if (cmd === "help") return commands.map((command) => ({ command }));
  if (
    [
      "responders",
      "policies",
      "services",
      "handovers",
      "actions",
      "audit",
    ].includes(cmd)
  )
    return db.query(`select * from ${cmd} order by created_at,id`);
  if (cmd === "import-health")
    return db.query(
      "select source,records,actor,created_at from imports order by created_at",
    );
  if (cmd === "attention")
    return db.query("select * from v_attention order by reason,code");
  if (cmd === "compliance") return compliance(db, o);
  if (cmd === "import") return importPd(db, o, pos);
  if (
    ["roster", "coverage", "workload", "conflicts", "weekly-review"].includes(
      cmd,
    )
  ) {
    const c = await context(db, o);
    if (cmd === "roster")
      return c.slots.filter((s) =>
        c.policies.some((p) => p.code === s.policy_code),
      );
    if (cmd === "coverage") return coverage(c);
    if (cmd === "workload")
      return workload({
        ...c,
        slots: c.slots.filter((s) =>
          c.policies.some((p) => p.code === s.policy_code),
        ),
      });
    if (cmd === "conflicts") return conflicts(c);
    return [
      {
        from: c.from,
        to: c.to,
        gaps: coverage(c).filter((r) => r.state === "GAP").length,
        concurrent_duties: conflicts(c).length,
        attention_items: (await db.query("select * from v_attention")).length,
      },
    ];
  }
  if (cmd === "who-is-on" || cmd === "escalation-check") {
    const at = instant(o.at || new Date().toISOString());
    const c = await context(db, {
      ...o,
      from: at,
      to: iso(Date.parse(at) + 1000),
    });
    return coverage(c).map((r) => ({
      policy: r.policy,
      level: r.level,
      at,
      responders: r.responders || "NONE",
      state: r.state,
      delivery: "Simulation only",
    }));
  }
  if (cmd === "export") {
    const result = {
      format: "on-call-coverage-v1",
      exported_at: new Date().toISOString(),
    };
    await db.exec("BEGIN READ ONLY");
    try {
      for (const t of [...entities, "audit", "imports"])
        result[t] = await db.query(`select * from ${t} order by id`);
    } finally {
      await db.exec("ROLLBACK");
    }
    const file = path.resolve(need(o, "file"));
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(result, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    return [
      { file, records: entities.reduce((n, t) => n + result[t].length, 0) },
    ];
  }
  if (cmd === "draft-handover") {
    const p = await match(db, "policies", need(o, "policy"));
    const c = await context(db, { ...o, policy: p.code });
    const rows = coverage(c).filter((r) => r.state === "GAP");
    const text = `# ${p.name}: draft handover\n\nWindow ${c.from} to ${c.to}. UTC. No notifications sent.\n\n${format(rows)}\n\nOpen handovers\n${format(await db.query("select code,name,owner,due_at from handovers where policy_id=$1 and status='open'", [p.id]))}\n`;
    const dir = path.join(process.env.OUTPUT_DIR || REPO_ROOT, "drafts");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, `handover-${p.id}-${randomUUID()}.md`);
    fs.writeFileSync(file, text, { mode: 0o600, flag: "wx" });
    return [{ file }];
  }
  return transact(db, async () => {
    const actor = need(o, "actor");
    let t, id, code;
    if (cmd.startsWith("add-")) {
      const singular = cmd.slice(4);
      t = {
        responder: "responders",
        policy: "policies",
        service: "services",
        slot: "slots",
        handover: "handovers",
        action: "actions",
      }[singular];
      code = need(o, "code");
      if (!/^[A-Za-z0-9:_-]{1,100}$/.test(code))
        throw Error(
          "Code must be 1 to 100 letters, digits, colon, underscore or hyphen",
        );
      let cols = ["code"],
        vals = [code];
      const add = (k, v) => {
        cols.push(k);
        vals.push(v);
      };
      if (t !== "slots") add("name", need(o, "name"));
      if (t === "responders" || t === "policies")
        add("review_due", day(need(o, "review-due")));
      if (t === "policies") {
        add("owner", need(o, "owner"));
        add("levels", number(o.levels || 2, 1, 10));
      }
      if (["services", "slots", "handovers"].includes(t))
        add("policy_id", (await match(db, "policies", need(o, "policy"))).id);
      if (t === "slots") {
        const p = (
          await db.query("select levels from policies where id=$1", [
            vals[cols.indexOf("policy_id")],
          ])
        )[0];
        add(
          "responder_id",
          (await match(db, "responders", need(o, "responder"))).id,
        );
        add("level", number(need(o, "level"), 1, p.levels));
        add("starts_at", instant(need(o, "from")));
        add("ends_at", instant(need(o, "to")));
        add("schedule", o.schedule || "Manual assignment");
      }
      if (t === "handovers" || t === "actions") {
        add("owner", need(o, "owner"));
        add(
          t === "actions" ? "due_on" : "due_at",
          t === "actions" ? day(need(o, "due")) : instant(need(o, "due")),
        );
      }
      const rows = await db.query(
        `insert into ${t}(${cols.join(",")}) values(${vals.map((v, i) => "$" + (i + 1)).join(",")}) returning id,code`,
        vals,
      );
      id = rows[0].id;
    } else if (cmd === "verify-slot") {
      const r = await match(db, "slots", need(o, "record"));
      id = r.id;
      code = r.code;
      await db.query("update slots set verified=true,evidence=$2 where id=$1", [
        id,
        need(o, "evidence"),
      ]);
    } else if (cmd === "revise-slot") {
      const r = await match(db, "slots", need(o, "record"));
      id = r.id;
      code = r.code;
      const prior = await db.query("select * from slots where id=$1", [id]);
      await audit(
        db,
        o,
        "slot-before-revision",
        code,
        JSON.stringify(prior[0]),
      );
      await db.query(
        "update slots set starts_at=$2,ends_at=$3,verified=false,evidence=$4 where id=$1",
        [
          id,
          instant(need(o, "from")),
          instant(need(o, "to")),
          need(o, "evidence"),
        ],
      );
    } else if (cmd === "review-policy" || cmd === "review-responder") {
      t = cmd === "review-policy" ? "policies" : "responders";
      const r = await match(db, t, need(o, "record"));
      id = r.id;
      code = r.code;
      need(o, "evidence");
      await db.query(`update ${t} set review_due=$2 where id=$1`, [
        id,
        day(need(o, "review-due")),
      ]);
      if (t === "policies") {
        await db.query("update policies set owner=$2,levels=$3 where id=$1", [
          id,
          need(o, "owner"),
          number(need(o, "levels"), 1, 10),
        ]);
      } else if (o.active !== undefined) {
        if (!["true", "false"].includes(o.active))
          throw Error("Active must be true or false");
        await db.query("update responders set active=$2 where id=$1", [
          id,
          o.active === "true",
        ]);
      }
    } else if (cmd === "complete") {
      t = need(o, "type");
      if (!["handovers", "actions"].includes(t))
        throw Error("Complete type must be handovers or actions");
      const r = await match(db, t, need(o, "record"));
      id = r.id;
      code = r.code;
      await db.query(`update ${t} set status='done',evidence=$2 where id=$1`, [
        id,
        need(o, "evidence"),
      ]);
    } else if (cmd === "log") {
      t = need(o, "type");
      const r = await match(db, t, need(o, "record"));
      code = r.code;
      id = r.id;
      need(o, "evidence");
    }
    await audit(db, o, cmd, code, o.evidence || `Recorded by ${actor}`);
    return [{ id, code, operation: cmd }];
  });
}
export function format(rows) {
  if (!rows.length) return "  (none)";
  return table(
    rows,
    Object.keys(rows[0]).map((key) => ({
      key,
      label: key.replaceAll("_", " "),
      format: (v) =>
        v instanceof Date
          ? iso(v)
          : v !== null && typeof v === "object"
            ? JSON.stringify(v)
            : v,
    })),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    db = await getDb();
    const rows = await execute(db, process.argv.slice(2));
    console.log(
      process.argv.includes("--json")
        ? JSON.stringify(rows, null, 2)
        : format(rows),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
