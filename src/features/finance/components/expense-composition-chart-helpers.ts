import type { ExpenseCompositionRow } from '../api/finance-api'

function safeNumber(value: number) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

export function sortExpenseComposition(rows: ExpenseCompositionRow[]) {
  return rows
    .map(row => ({
      ...row,
      amount: safeNumber(row.amount),
      percentage: safeNumber(row.percentage),
    }))
    .sort((left, right) => right.amount - left.amount)
}
