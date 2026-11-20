# EvalBench

An eval-first workbench for authoring and grading AI agent tasks.

Most "agent engineering" portfolios show a demo. This shows the **grading harness** — the part that actually decides whether a model is good enough to ship. Every tool here comes with the task brief, the reference solution, and the checks that catch lazy answers.

**[Live demo →](https://evalbench-roan.vercel.app)** · Built by [Mahaveer Amrani](https://mahaveeramrani.vercel.app)

---

## What it is

Three tabs, one real workflow:

**01 / Playground** — a live port of `calculate_churn_risk()` from [Churnable](https://github.com/emminence-00/churnable), my production LangGraph agent that scores 750+ accounts. Toggle between:
- **v1 · shipped** — five behavioural factors, 100-point budget, zero label leakage
- **v2 · proposed** — adds a Balance Decline factor, funded by rebalancing Inactivity from 30 → 25

Every score comes with a factor breakdown and at most two plain-English drivers. No black box.

**02 / Eval Suite** — eight must-pass checks written against the v2 change. They target the ways a model gets a rebalance subtly wrong: wrong band, wrong cap, NaN crash, label leakage, broken output shape, shifted boundaries. Run them in-browser. All eight pass.

**03 / Task Brief** — the actual brief, written from a codebase I own. Hard for a model to get right end to end, fair for a skilled engineer. Includes the six specific failure modes and four stress tests.

## Why this exists

I applied to an eval-focused AI engineering role. Instead of describing myself as "eval-first", I built the artefact: a task authored from my own code, with a reference solution and a grading suite that a reviewer can run in ten seconds.

The point isn't the UI. It's the claim underneath it:

> I don't just write prompts. I write the checks that decide whether a prompt is allowed to ship.

## The scoring change, for the curious

The dataset has a `balance_change_percentage` column. `check_data_quality()` already reports balance analysis as supported. The scorer ignored it.

Fix:
- Add **Balance Decline**, up to 10 points (`<= -30` → 10, `-30 < x < -10` → 5, NaN/positive → 0)
- Reduce **Inactivity** from 30 → 25, tiers `25 / 15 / 7`
- Keep the `35 / 60` category boundaries, the two-driver cap, and the zero-label-leakage rule (never read `churned`)

Total budget stays at 100. The cap survives. Nothing leaks.

## Stack

React 19 · TypeScript · Vite 6. No backend, no API keys, no network calls — the eval suite runs entirely client-side.

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build     # type-check + production build
```

The eight grading checks run in the **Eval Suite** tab of the app itself — no test framework, no API keys, no network.

## Files

```
src/
  lib/scoring.ts   # v1 + v2 scorers, faithful ports
  lib/evals.ts     # 8 grading cases + runner
  App.tsx          # three-tab workbench
  styles.css       # dark, dense, deliberately un-cute
```

## Links

- Portfolio: https://mahaveeramrani.vercel.app
- GitHub: https://github.com/emminence-00
- Churnable (the source system): https://churnable.onrender.com
