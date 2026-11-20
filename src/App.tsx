import { useMemo, useState } from 'react'
import { emptyInput, scoreV1, scoreV2, type RiskInput } from './lib/scoring'
import { runEvals, type EvalResult } from './lib/evals'
import './styles.css'

type Tab = 'playground' | 'evals' | 'brief'
type Version = 'v1' | 'v2'

const FIELDS: Array<{
  key: keyof RiskInput
  label: string
  hint: string
  max: number
  step?: number
}> = [
  { key: 'daysSinceLastTransaction', label: 'Days since last transaction', hint: 'inactivity, up to 30 → 25 pts', max: 90 },
  { key: 'transactionsLast30', label: 'Transactions last 30 days', hint: 'velocity drop, up to 25 pts', max: 30 },
  { key: 'transactionsPrevious30', label: 'Transactions previous 30 days', hint: 'baseline for the drop', max: 30 },
  { key: 'loginsLast30', label: 'Logins last 30 days', hint: 'digital activity, up to 15 pts', max: 40 },
  { key: 'failedTransactions', label: 'Failed transactions', hint: 'operational friction, up to 15 pts', max: 10 },
  { key: 'supportComplaints', label: 'Support complaints', hint: 'support friction, up to 15 pts', max: 10 },
  { key: 'balanceChangePercentage', label: 'Balance change %', hint: 'v2 only, up to 10 pts', max: 20, step: 1 },
]

const categoryClass = (c: string) => `badge badge-${c.toLowerCase()}`

function Playground() {
  const [input, setInput] = useState<RiskInput>(emptyInput)
  const [version, setVersion] = useState<Version>('v2')

  const result = useMemo(
    () => (version === 'v2' ? scoreV2(input) : scoreV1(input)),
    [input, version],
  )

  const set = (key: keyof RiskInput, value: number) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="playground">
      <div className="panel">
        <div className="panel-head">
          <h2>Account signals</h2>
          <div className="toggle" role="group" aria-label="scorer version">
            <button
              className={version === 'v1' ? 'on' : ''}
              onClick={() => setVersion('v1')}
            >v1 · shipped</button>
            <button
              className={version === 'v2' ? 'on' : ''}
              onClick={() => setVersion('v2')}
            >v2 · proposed</button>
          </div>
        </div>
        <p className="muted">Port of <code>calculate_churn_risk()</code> from Churnable's <code>tools.py</code>. No labels, no black box.</p>
        <div className="fields">
          {FIELDS.map((f) => {
            const value = Number(input[f.key] ?? 0)
            const disabled = f.key === 'balanceChangePercentage' && version === 'v1'
            return (
              <label className={`field${disabled ? ' disabled' : ''}`} key={f.key}>
                <span className="field-top">
                  <span>{f.label}</span>
                  <strong>{Number.isNaN(value) ? 'NaN' : value}</strong>
                </span>
                <input
                  type="range"
                  min={f.key === 'balanceChangePercentage' ? -100 : 0}
                  max={f.max}
                  step={f.step ?? 1}
                  value={Number.isNaN(value) ? 0 : value}
                  disabled={disabled}
                  onChange={(e) => set(f.key, Number(e.target.value))}
                />
                <span className="hint">{f.hint}</span>
              </label>
            )
          })}
        </div>
        <button className="reset" onClick={() => setInput(emptyInput())}>reset to baseline</button>
      </div>

      <div className="panel result-panel">
        <div className="panel-head"><h2>Score output</h2></div>
        <div className="score-row">
          <div className="score-number">{result.score}</div>
          <div>
            <div className={categoryClass(result.category)}>{result.category} risk</div>
            <div className="muted small">transparent, rule-based, 0–100</div>
          </div>
        </div>

        <h3>Factor breakdown</h3>
        <div className="factors">
          {result.factors.map((f) => {
            const max = f.name === 'Inactivity' ? (version === 'v2' ? 25 : 30)
              : f.name === 'Balance decline' ? 10
              : f.name === 'Velocity drop' ? 25 : 15
            return (
              <div className="factor" key={f.name}>
                <div className="factor-label">
                  <span>{f.name}</span><span>{f.points} / {max}</span>
                </div>
                <div className="track"><div className="fill" style={{ width: `${(f.points / max) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>

        <h3>Primary drivers</h3>
        <p className="drivers">{result.primaryDrivers}</p>
        <p className="muted small">Two-driver cap preserved from the original implementation.</p>
      </div>
    </div>
  )
}

function Evals() {
  const [results, setResults] = useState<EvalResult[] | null>(null)
  const [ran, setRan] = useState(false)

  const run = () => {
    setResults(runEvals())
    setRan(true)
  }

  const passed = results?.filter((r) => r.pass).length ?? 0
  const total = results?.length ?? 0

  return (
    <div className="panel eval-panel">
      <div className="panel-head">
        <h2>Must-pass grading checks</h2>
        <button className="run" onClick={run}>run suite</button>
      </div>
      <p className="muted">These are the checks shipped with the task brief. They target the ways a model gets a rebalance subtly wrong: wrong band, wrong cap, leaked label, broken output shape.</p>

      {ran && (
        <div className="summary">
          <strong className={passed === total ? 'ok' : 'fail'}>{passed} / {total} passing</strong>
          <span className="muted small">evaluated locally, no network</span>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>status</th><th>check</th><th>expected</th><th>actual</th><th>why it matters</th></tr>
          </thead>
          <tbody>
            {(results ?? []).map((r) => (
              <tr key={r.id} className={r.pass ? 'pass' : 'fail-row'}>
                <td><span className={r.pass ? 'tag ok' : 'tag fail'}>{r.pass ? 'PASS' : 'FAIL'}</span></td>
                <td><strong>{r.title}</strong>{!r.pass && <div className="failure">{r.failure}</div>}</td>
                <td><code>{r.expectedScore}{r.expectedCategory ? ` · ${r.expectedCategory}` : ''}</code></td>
                <td><code>{r.actualScore}{r.actualCategory ? ` · ${r.actualCategory}` : ''}</code></td>
                <td className="why">{r.why}</td>
              </tr>
            ))}
            {!ran && (
              <tr><td colSpan={5} className="empty">hit <code>run suite</code> to grade the v2 scorer</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Brief() {
  return (
    <div className="panel brief-panel">
      <div className="panel-head"><h2>Task brief · balance decline factor</h2></div>
      <p className="muted">A real change from a codebase I own. Hard for a model to get right end to end, fair for a skilled engineer. This is the artefact, not a description of one.</p>

      <div className="brief-grid">
        <section>
          <h3>The change</h3>
          <p><code>calculate_churn_risk()</code> in <code>tools.py</code> scores accounts out of 100 using five behavioural factors. The dataset has a <code>balance_change_percentage</code> column and <code>check_data_quality()</code> already reports balance analysis as supported, but the score ignores it.</p>
          <p>Add a <strong>Balance Decline</strong> factor worth up to 10 points, funded by reducing Inactivity from 30 to 25 with tiers 25 / 15 / 7.</p>
          <ul>
            <li><code>&lt;= -30</code> → 10 points, driver <code>Balance declined sharply</code></li>
            <li><code>-30 &lt; x &lt; -10</code> → 5 points, driver <code>Balance declining</code></li>
            <li>NaN or positive → 0 points, no driver</li>
          </ul>
          <p>Keep the 35 / 60 category boundaries, the two-driver cap, and the zero-label-leakage rule. Never read <code>churned</code>.</p>
        </section>

        <section>
          <h3>Why models fail it</h3>
          <ol>
            <li>Forget to rebalance the 100-point budget, so the cap silently breaks.</li>
            <li>Scale inactivity tiers linearly and land on 24 / 16 / 8 instead of 25 / 15 / 7.</li>
            <li>Crash on NaN because CSV exports have holes.</li>
            <li>Read the <code>churned</code> label "just to check", which is leakage.</li>
            <li>Break the driver cap by appending a third reason.</li>
            <li>Shift category thresholds while touching the scorer.</li>
          </ol>
          <p className="muted small">Seven automated checks in the Eval Suite tab catch every one of these.</p>
        </section>

        <section>
          <h3>Stress tests</h3>
          <ul>
            <li>Empty dataset → no division by zero, <code>total_evaluated: 0</code>.</li>
            <li>All values missing in the new column → identical scores to v1.</li>
            <li>Balance of -100 → still capped at 10 points.</li>
            <li>Duplicate customer IDs → scores align to correct rows, not raw numpy indices.</li>
          </ul>
        </section>

        <section>
          <h3>Constraints</h3>
          <p>Keep it local. No public PR, no fork, no published brief. The work stays private.</p>
          <div className="repo-line"><span>repo</span><code>github.com/emminence-00/churnable</code></div>
          <div className="repo-line"><span>source</span><code>tools.py · calculate_churn_risk()</code></div>
        </section>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('playground')

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="mark">EB</span>
          <div>
            <strong>EVALBENCH</strong>
            <span className="sub">eval-first agent engineering</span>
          </div>
        </div>
        <a href="https://github.com/emminence-00" target="_blank" rel="noreferrer">github ↗</a>
      </header>

      <main>
        <div className="hero">
          <div className="eyebrow">A workbench, not a demo reel</div>
          <h1>Every tool ships with evals.</h1>
          <p>Author a task from a codebase you know. Write the brief, the reference solution and the checks that catch lazy answers. Then stress-test it until strong models fail and a skilled engineer can clearly solve it.</p>
          <p className="muted">Built by Mahaveer Amrani. The scorer below is a faithful port of the one running in <a href="https://churnable.onrender.com" target="_blank" rel="noreferrer">Churnable</a>.</p>
        </div>

        <nav className="tabs" role="tablist">
          <button className={tab === 'playground' ? 'active' : ''} onClick={() => setTab('playground')}>01 / playground</button>
          <button className={tab === 'evals' ? 'active' : ''} onClick={() => setTab('evals')}>02 / eval suite</button>
          <button className={tab === 'brief' ? 'active' : ''} onClick={() => setTab('brief')}>03 / task brief</button>
        </nav>

        {tab === 'playground' && <Playground />}
        {tab === 'evals' && <Evals />}
        {tab === 'brief' && <Brief />}
      </main>

      <footer>
        <span>mahaveer amrani · karachi, pk</span>
        <span>no labels leaked, no shortcuts taken</span>
      </footer>
    </div>
  )
}
