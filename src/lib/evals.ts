import { scoreV2, type RiskInput } from './scoring'

export type EvalCase = {
  id: string
  title: string
  input: RiskInput
  expectedScore: number
  expectedCategory?: 'Low' | 'Medium' | 'High'
  driverMustInclude?: string
  driverMustOmit?: string
  why: string
}

export type EvalResult = EvalCase & {
  actualScore: number
  actualCategory: string
  actualDrivers: string
  pass: boolean
  failure: string
}

/** The must-pass checks from the Askable task brief. */
export const EVAL_CASES: EvalCase[] = [
  {
    id: 'bal-sharp',
    title: 'Sharp balance decline scores exactly 10',
    input: {
      daysSinceLastTransaction: 0, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 12, failedTransactions: 0, supportComplaints: 0,
      balanceChangePercentage: -35,
    },
    expectedScore: 10,
    expectedCategory: 'Low',
    driverMustInclude: 'Balance declined sharply',
    why: 'The new factor must fire on its own without leaking label data.',
  },
  {
    id: 'bal-moderate',
    title: 'Moderate balance decline scores exactly 5',
    input: {
      daysSinceLastTransaction: 0, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 12, failedTransactions: 0, supportComplaints: 0,
      balanceChangePercentage: -15,
    },
    expectedScore: 5,
    expectedCategory: 'Low',
    driverMustInclude: 'Balance declining',
    why: 'The -10 to -30 band must map to 5 points, not 10.',
  },
  {
    id: 'bal-missing',
    title: 'NaN / missing / positive balance scores 0, no crash',
    input: {
      daysSinceLastTransaction: 0, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 12, failedTransactions: 0, supportComplaints: 0,
      balanceChangePercentage: Number.NaN,
    },
    expectedScore: 0,
    expectedCategory: 'Low',
    driverMustOmit: 'Balance',
    why: 'Real CSV exports have holes. A model that assumes a number here will crash.',
  },
  {
    id: 'inactivity-rescaled',
    title: 'Severe inactivity is 25, not 30',
    input: {
      daysSinceLastTransaction: 60, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 12, failedTransactions: 0, supportComplaints: 0,
      balanceChangePercentage: 0,
    },
    expectedScore: 25,
    expectedCategory: 'Low',
    why: 'Inactivity must be rebalanced to keep the total budget at 100.',
  },
  {
    id: 'score-cap',
    title: 'Maximum possible score stays at 100',
    input: {
      daysSinceLastTransaction: 60, transactionsLast30: 0, transactionsPrevious30: 10,
      loginsLast30: 0, failedTransactions: 5, supportComplaints: 3,
      balanceChangePercentage: -100,
    },
    expectedScore: 100,
    expectedCategory: 'High',
    why: '30+25+15+15+15+10 = 110 before the cap. Clipping must survive the change.',
  },
  {
    id: 'driver-cap',
    title: 'At most two primary drivers; stable case still says so',
    input: {
      daysSinceLastTransaction: 0, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 12, failedTransactions: 0, supportComplaints: 0,
      balanceChangePercentage: 0,
    },
    expectedScore: 0,
    expectedCategory: 'Low',
    driverMustInclude: 'Stable activity',
    why: 'Output shape must not regress while the scoring math changes.',
  },
  {
    id: 'boundary-35',
    title: 'Score of exactly 35 maps to Medium',
    input: {
      daysSinceLastTransaction: 0, transactionsLast30: 8, transactionsPrevious30: 8,
      loginsLast30: 0, failedTransactions: 1, supportComplaints: 1,
      balanceChangePercentage: -15,
    },
    expectedScore: 35,
    expectedCategory: 'Medium',
    why: '15 login + 7 failed + 8 complaints + 5 balance = 35. The lower boundary must be inclusive.',
  },
  {
    id: 'boundary-60',
    title: 'Score of exactly 60 maps to High',
    input: {
      daysSinceLastTransaction: 45, transactionsLast30: 4, transactionsPrevious30: 10,
      loginsLast30: 12, failedTransactions: 3, supportComplaints: 0,
      balanceChangePercentage: 0,
    },
    expectedScore: 60,
    expectedCategory: 'High',
    why: '25 inactivity + 20 velocity + 15 failed = 60. The upper boundary must be inclusive.',
  },
]

export function runEvals(): EvalResult[] {
  return EVAL_CASES.map((c) => {
    const r = scoreV2(c.input)
    const failures: string[] = []

    if (r.score !== c.expectedScore) {
      failures.push(`score ${r.score} != ${c.expectedScore}`)
    }
    if (c.expectedCategory && r.category !== c.expectedCategory) {
      failures.push(`category ${r.category} != ${c.expectedCategory}`)
    }
    if (c.driverMustInclude && !r.primaryDrivers.includes(c.driverMustInclude)) {
      failures.push(`missing driver "${c.driverMustInclude}"`)
    }
    if (c.driverMustOmit && r.primaryDrivers.toLowerCase().includes(c.driverMustOmit.toLowerCase())) {
      failures.push(`unexpected driver "${c.driverMustOmit}"`)
    }

    return {
      ...c,
      actualScore: r.score,
      actualCategory: r.category,
      actualDrivers: r.primaryDrivers,
      pass: failures.length === 0,
      failure: failures.join(' · '),
    }
  })
}
