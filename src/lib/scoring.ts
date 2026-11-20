export type RiskInput = {
  daysSinceLastTransaction: number
  transactionsLast30: number
  transactionsPrevious30: number
  loginsLast30: number
  failedTransactions: number
  supportComplaints: number
  balanceChangePercentage?: number
}

export type Factor = {
  name: string
  points: number
  driver?: string
}

export type ScoreResult = {
  score: number
  category: 'Low' | 'Medium' | 'High'
  drivers: string[]
  primaryDrivers: string
  factors: Factor[]
}

const categoryFor = (score: number): ScoreResult['category'] =>
  score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low'

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * v1: faithful port of `calculate_churn_risk()` from Churnable's tools.py.
 * Five behavioural factors, 100-point budget, zero label leakage.
 */
export function scoreV1(input: RiskInput): ScoreResult {
  const factors: Factor[] = []
  const drivers: string[] = []
  let raw = 0

  // 1. Inactivity — up to 30
  const days = input.daysSinceLastTransaction || 0
  let inactivity = 0
  if (days >= 45) {
    inactivity = 30
    drivers.push(`Severe inactivity (${Math.trunc(days)} days)`)
  } else if (days >= 20) {
    inactivity = 18
    drivers.push(`Noticeable inactivity (${Math.trunc(days)} days)`)
  } else if (days >= 10) {
    inactivity = 8
  }
  raw += inactivity
  factors.push({ name: 'Inactivity', points: inactivity })

  // 2. Transaction velocity drop — up to 25
  const last = input.transactionsLast30 || 0
  const prev = input.transactionsPrevious30 || 0
  let velocity = 0
  const ratio = prev > 0 ? (prev - last) / prev : 0
  if (prev > 0 && last === 0) {
    velocity = 25
    drivers.push('Transactions ceased completely to 0')
  } else if (prev > 0 && ratio >= 0.5) {
    velocity = 20
    drivers.push(`Sharp transaction drop (-${Math.round(ratio * 100)}%)`)
  } else if (prev > 0 && ratio >= 0.25) {
    velocity = 10
  }
  raw += velocity
  factors.push({ name: 'Velocity drop', points: velocity })

  // 3. Low digital logins — up to 15
  const logins = input.loginsLast30 || 0
  const loginPoints = logins <= 2 ? 15 : logins <= 6 ? 8 : 0
  if (logins <= 2) drivers.push(`Infrequent digital logins (${Math.trunc(logins)}/mo)`)
  raw += loginPoints
  factors.push({ name: 'Login activity', points: loginPoints })

  // 4. Failed transactions — up to 15
  const failed = input.failedTransactions || 0
  const failPoints = failed >= 3 ? 15 : failed >= 1 ? 7 : 0
  if (failed >= 3) drivers.push(`High failed transactions (${Math.trunc(failed)} failed)`)
  raw += failPoints
  factors.push({ name: 'Failed payments', points: failPoints })

  // 5. Support complaints — up to 15
  const comp = input.supportComplaints || 0
  const compPoints = comp >= 2 ? 15 : comp === 1 ? 8 : 0
  if (comp >= 1) drivers.push(`Unresolved complaints filed (${Math.trunc(comp)})`)
  raw += compPoints
  factors.push({ name: 'Support friction', points: compPoints })

  const score = round1(Math.min(100, Math.max(0, raw)))
  return {
    score,
    category: categoryFor(score),
    drivers,
    primaryDrivers: drivers.length ? drivers.slice(0, 2).join(', ') : 'Stable activity',
    factors,
  }
}

/**
 * v2: the proposed extension — add a Balance Decline factor worth 10 points,
 * funded by reducing Inactivity from 30 to 25 (tiers 25 / 15 / 7).
 * This is the exact change in the Askable task brief.
 */
export function scoreV2(input: RiskInput): ScoreResult {
  const factors: Factor[] = []
  const drivers: string[] = []
  let raw = 0

  const days = input.daysSinceLastTransaction || 0
  let inactivity = 0
  if (days >= 45) {
    inactivity = 25
    drivers.push(`Severe inactivity (${Math.trunc(days)} days)`)
  } else if (days >= 20) {
    inactivity = 15
    drivers.push(`Noticeable inactivity (${Math.trunc(days)} days)`)
  } else if (days >= 10) {
    inactivity = 7
  }
  raw += inactivity
  factors.push({ name: 'Inactivity', points: inactivity })

  const last = input.transactionsLast30 || 0
  const prev = input.transactionsPrevious30 || 0
  let velocity = 0
  const ratio = prev > 0 ? (prev - last) / prev : 0
  if (prev > 0 && last === 0) {
    velocity = 25
    drivers.push('Transactions ceased completely to 0')
  } else if (prev > 0 && ratio >= 0.5) {
    velocity = 20
    drivers.push(`Sharp transaction drop (-${Math.round(ratio * 100)}%)`)
  } else if (prev > 0 && ratio >= 0.25) {
    velocity = 10
  }
  raw += velocity
  factors.push({ name: 'Velocity drop', points: velocity })

  const logins = input.loginsLast30 || 0
  const loginPoints = logins <= 2 ? 15 : logins <= 6 ? 8 : 0
  if (logins <= 2) drivers.push(`Infrequent digital logins (${Math.trunc(logins)}/mo)`)
  raw += loginPoints
  factors.push({ name: 'Login activity', points: loginPoints })

  const failed = input.failedTransactions || 0
  const failPoints = failed >= 3 ? 15 : failed >= 1 ? 7 : 0
  if (failed >= 3) drivers.push(`High failed transactions (${Math.trunc(failed)} failed)`)
  raw += failPoints
  factors.push({ name: 'Failed payments', points: failPoints })

  const comp = input.supportComplaints || 0
  const compPoints = comp >= 2 ? 15 : comp === 1 ? 8 : 0
  if (comp >= 1) drivers.push(`Unresolved complaints filed (${Math.trunc(comp)})`)
  raw += compPoints
  factors.push({ name: 'Support friction', points: compPoints })

  const bal = input.balanceChangePercentage
  let balance = 0
  if (bal !== undefined && Number.isFinite(bal)) {
    if (bal <= -30) {
      balance = 10
      drivers.push(`Balance declined sharply (${Math.round(bal)}%)`)
    } else if (bal < -10) {
      balance = 5
      drivers.push(`Balance declining (${Math.round(bal)}%)`)
    }
  }
  raw += balance
  factors.push({ name: 'Balance decline', points: balance })

  const score = round1(Math.min(100, Math.max(0, raw)))
  return {
    score,
    category: categoryFor(score),
    drivers,
    primaryDrivers: drivers.length ? drivers.slice(0, 2).join(', ') : 'Stable activity',
    factors,
  }
}

export const emptyInput = (): RiskInput => ({
  daysSinceLastTransaction: 0,
  transactionsLast30: 8,
  transactionsPrevious30: 10,
  loginsLast30: 12,
  failedTransactions: 0,
  supportComplaints: 0,
  balanceChangePercentage: 0,
})
