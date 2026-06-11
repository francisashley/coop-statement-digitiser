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

  const allTransactions: ImportTransaction[] = []

  for (const jsonFile of sortedFiles) {
    const filePath = join(inputPath, jsonFile)
    const data: StatementData = JSON.parse(readFileSync(filePath, 'utf-8'))

    for (const t of data.transactions) {
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
  console.log(`${account}: exported ${allTransactions.length} transactions to ${exportFilePath}`)
}
