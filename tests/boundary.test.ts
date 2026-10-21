import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

// "The AI reads; rules decide; only code moves money." This test enforces it on the source itself,
// so the promise can't quietly erode as the code changes:
//  1. No module that talks to an AI model can reach the PayPal client, even indirectly.
//  2. Only the workflow (the state machine, after deterministic rules) calls the money-moving
//     PayPal functions: capture, void, reauthorize, payout.
//  3. The ledger assistant's server route and its browser agent can't reach the workflow or PayPal.

const SRC = path.join(process.cwd(), "src");
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
};
walk(SRC);

const resolve = (from: string, spec: string) => {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
};
const imports = new Map<string, string[]>();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // value imports only: `import type` can't execute anything
  const specs = [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm), ...src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  imports.set(f, specs.map((s) => resolve(f, s)).filter((x): x is string => !!x));
}
const reaches = (from: string, target: string, seen = new Set<string>()): string[] | null => {
  if (from === target) return [from];
  if (seen.has(from)) return null;
  seen.add(from);
  for (const n of imports.get(from) ?? []) {
    const p = reaches(n, target, seen);
    if (p) return [from, ...p];
  }
  return null;
};
const rel = (p: string) => path.relative(process.cwd(), p);
const LIB = (n: string) => path.join(SRC, "lib", n);
const PAYPAL = LIB("paypal.ts");

test("modules that talk to an AI model can't reach the PayPal client", () => {
  const ai = files.filter((f) => f.startsWith(path.join(SRC, "lib")) && (imports.get(f) ?? []).includes(LIB("ai.ts")));
  assert.ok(ai.length >= 2, `found the AI modules: ${ai.map(rel).join(", ")}`);
  for (const f of [...ai, LIB("ai.ts")]) {
    const p = reaches(f, PAYPAL);
    assert.equal(p, null, `${rel(f)} can reach PayPal via ${p?.map(rel).join(" → ")}`);
  }
});

test("only the workflow calls capture, void, reauthorize or payout", () => {
  const MONEY = /\b(captureAuthorization|voidAuthorization|reauthorize|createPayout)\s*\(/;
  const callers = files.filter((f) => f !== PAYPAL && MONEY.test(readFileSync(f, "utf8")));
  assert.deepEqual(callers.map(rel), [rel(LIB("workflow.ts"))]);
});

test("the ledger assistant can't reach the workflow or PayPal", () => {
  for (const f of [path.join(SRC, "app/api/studio-ai/route.ts"), path.join(SRC, "components/ledgerStudio.tsx")]) {
    for (const t of [PAYPAL, LIB("workflow.ts")]) {
      const p = reaches(f, t);
      assert.equal(p, null, `${rel(f)} reaches ${rel(t)} via ${p?.map(rel).join(" → ")}`);
    }
  }
});
