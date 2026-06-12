import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface Transaction {
  date: string | null
  description: string | null
  moneyOut: number | null
  moneyIn: number | null
  balance: number | null
}

interface StatementData {
  summary: {
    statementDate: string | null
    statementNumber: number | null
    openingBalance: number | null
    closingBalance: number | null
  }
  transactions: Transaction[]
}

interface StatementFile {
  filename: string
  number: number
  data: StatementData
  missing: boolean
}

type ImportTransaction =
  | {
      type: 'income'
      date: string
      description?: string
      received_amount: number
      received_currency: string
    }
  | {
      type: 'expense'
      date: string
      description?: string
      sent_amount: number
      sent_currency: string
    }
  | {
      type: 'adjustment'
      date: string
      description?: string
      amount: number
      currency: string
    }

const inputPath = join(process.cwd(), 'input')
const outputPath = join(process.cwd(), 'output')

if (!existsSync(inputPath)) {
  console.log(`Input directory not found: ${inputPath}`)
  process.exit(1)
}

mkdirSync(outputPath, { recursive: true })

const allFiles = readdirSync(inputPath)
const jsonFiles = allFiles.filter((filename) => filename.match(/^[a-z]+-\d+\.json$/i))

const accountsMap = new Map<string, string[]>()

for (const jsonFile of jsonFiles) {
  const match = jsonFile.match(/^([a-z]+)-(\d+)\.json$/i)
  if (!match) continue
  const account = match[1]
  if (!accountsMap.has(account)) {
    accountsMap.set(account, [])
  }
  accountsMap.get(account)!.push(jsonFile)
}

for (const [account, files] of accountsMap) {
  const sortedFiles = files.sort((fileA, fileB) => {
    const numA = parseInt(fileA.match(/-(\d+)\.json$/)?.[1] || '0')
    const numB = parseInt(fileB.match(/-(\d+)\.json$/)?.[1] || '0')
    return numA - numB
  })

  const statementFiles: StatementFile[] = sortedFiles.map((filename) => {
    const num = parseInt(filename.match(/-(\d+)\.json$/)?.[1] || '0')
    const filePath = join(inputPath, filename)
    const data: StatementData = JSON.parse(readFileSync(filePath, 'utf-8'))
    return { filename, number: num, data, missing: false }
  })

  const existingNumbers = statementFiles.map((s) => s.number)
  const minNumber = Math.min(...existingNumbers)
  const maxNumber = Math.max(...existingNumbers)

  for (let num = minNumber; num <= maxNumber; num++) {
    if (!existingNumbers.includes(num)) {
      statementFiles.push({
        filename: `${account}-${String(num).padStart(3, '0')}.json`,
        number: num,
        data: {
          summary: { statementDate: null, statementNumber: num, openingBalance: null, closingBalance: null },
          transactions: [],
        },
        missing: true,
      })
    }
  }

  statementFiles.sort((a, b) => a.number - b.number)

  const allTransactions: ImportTransaction[] = []
  let adjustmentCount = 0

  for (let i = 0; i < statementFiles.length; i++) {
    const stmt = statementFiles[i]

    if (stmt.missing) {
      const isFirstMissing = i === 0 || !statementFiles[i - 1].missing
      if (!isFirstMissing) continue

      const prevStmt = i > 0 ? statementFiles[i - 1] : null
      let missingEnd = i
      while (missingEnd < statementFiles.length - 1 && statementFiles[missingEnd + 1].missing) {
        missingEnd++
      }
      const nextStmt = missingEnd < statementFiles.length - 1 ? statementFiles[missingEnd + 1] : null

      if (prevStmt && nextStmt) {
        const prevClosing = prevStmt.data.summary.closingBalance
        const nextOpening = nextStmt.data.summary.openingBalance
        const adjustmentDate = nextStmt.data.transactions[0]?.date || nextStmt.data.summary.statementDate

        const missingNumbers = statementFiles.slice(i, missingEnd + 1).map((s) => s.number)
        const rangeStr =
          missingNumbers.length === 1
            ? `statement ${missingNumbers[0]}`
            : `statements ${missingNumbers[0]}-${missingNumbers[missingNumbers.length - 1]}`

        if (prevClosing !== null && nextOpening !== null && adjustmentDate) {
          const delta = Math.round((nextOpening - prevClosing) * 100) / 100
          const description = `ADJUSTMENT (${rangeStr} missing)`

          allTransactions.push({
            type: 'adjustment',
            date: adjustmentDate,
            description,
            amount: delta,
            currency: 'Fiat:GBP',
          })
          adjustmentCount++
        }
      }
      continue
    }

    for (const t of stmt.data.transactions) {
      if (!t.date) continue

      if (t.moneyIn !== null && t.moneyIn > 0) {
        allTransactions.push({
          type: 'income',
          date: t.date,
          description: t.description ?? undefined,
          received_amount: t.moneyIn,
          received_currency: 'Fiat:GBP',
        })
      } else if (t.moneyOut !== null && t.moneyOut > 0) {
        allTransactions.push({
          type: 'expense',
          date: t.date,
          description: t.description ?? undefined,
          sent_amount: t.moneyOut,
          sent_currency: 'Fiat:GBP',
        })
      }
    }
  }

  const exportFilePath = join(outputPath, `${account}-megistus-export.json`)
  writeFileSync(exportFilePath, JSON.stringify(allTransactions, null, 2) + '\n')
  console.log(
    `${account}: exported ${allTransactions.length} transactions (${adjustmentCount} adjustments) to ${exportFilePath}`,
  )
}
