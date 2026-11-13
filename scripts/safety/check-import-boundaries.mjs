import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectImportBoundaries } from './import-boundaries.mjs'

const repositoryRoot = new URL('../../', import.meta.url)

function collectFiles(directory, prefix = '') {
  const files = []
  const base = directory.endsWith('/') ? directory : `${directory}/`
  for (const entry of readdirSync(new URL(base, repositoryRoot), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...collectFiles(`${base}${entry.name}`, relative))
    else files.push(relative)
  }
  return files
}

// Offline static check only: no network, no database, no build.
const files = collectFiles('src/', 'src')
const result = inspectImportBoundaries({ root: fileURLToPath(repositoryRoot), files })

if (!result.passed) {
  console.error('IMPORT_BOUNDARY_VIOLATIONS')
  for (const violation of result.violations) {
    console.error(`  ${violation.file} -> ${violation.specifier} (${violation.reason})`)
  }
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ ...result, checked: 'src/' }))
}
