import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  classifyForbiddenTarget,
  collectImports,
  findProductionImportViolations,
  inspectImportBoundaries,
  resolveImportSpecifier,
} from './import-boundaries.mjs'

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'efetivaos-import-boundary-'))
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content, 'utf8')
  }
  const names = Object.keys(files)
  return { root, files: names }
}

test('classifies every forbidden target family', () => {
  assert.match(classifyForbiddenTarget('src/__mocks__/db.ts'), /__mocks__/)
  assert.match(classifyForbiddenTarget('src/features/__test-utils__/worker.ts'), /__test-utils__/)
  assert.match(classifyForbiddenTarget('src/test/setup.ts'), /src\/test/)
  assert.match(classifyForbiddenTarget('e2e/contracts.spec.ts'), /e2e/)
  assert.match(classifyForbiddenTarget('src/features/x.test.ts'), /\.test\.ts/)
  assert.match(classifyForbiddenTarget('src/features/x.test.tsx'), /\.test\.tsx/)
  assert.match(classifyForbiddenTarget('src/features/import-worker.test-helper.ts'), /test-helper/)
  assert.equal(classifyForbiddenTarget('src/features/crm/pages/client-contracts.tsx'), null)
  assert.equal(classifyForbiddenTarget('src/features/finance/lib/pdf-utils.ts'), null)
  assert.equal(classifyForbiddenTarget('src/features/pricing/quotations/quotation.types.ts'), null)
})

test('resolves relative and alias specifiers without touching the filesystem', () => {
  assert.equal(resolveImportSpecifier('src/app/router.tsx', '@/features/crm/pages/crm-page'), 'src/features/crm/pages/crm-page')
  assert.equal(resolveImportSpecifier('src/features/finance/lib/pdf-utils.ts', './pdf-utils'), 'src/features/finance/lib/pdf-utils')
  assert.equal(resolveImportSpecifier('src/features/finance/lib/pdf-utils.ts', '../queries/finance-queries'), 'src/features/finance/queries/finance-queries')
  assert.equal(resolveImportSpecifier('src/app/router.tsx', 'react-router-dom'), null)
})

test('collects static, type-only, re-export and dynamic import specifiers', () => {
  const source = [
    "import { a } from './a'",
    "import type { B } from './b'",
    "export { c } from './c'",
    "const d = await import('./d')",
  ].join('\n')
  assert.deepEqual(collectImports(source, 'src/x.ts').sort(), ['./a', './b', './c', './d'])
})

test('blocks production imports of test artifacts', () => {
  const { root, files } = project({
    'src/features/production.ts': "import { helper } from './worker.test-helper'\nimport { t } from './x.test'\nimport '@/test/setup'\nimport '../../e2e/fixture'\n",
    'src/features/worker.test-helper.ts': 'export const helper = 1\n',
    'src/features/x.test.ts': 'export const t = 1\n',
    'src/test/setup.ts': 'export {}\n',
    'e2e/fixture.ts': 'export {}\n',
  })
  const violations = findProductionImportViolations({ root, files })
  assert.equal(violations.length, 4)
  assert.deepEqual(violations.map(v => v.reason).sort(), [
    'end-to-end suite (e2e)',
    'shared test bootstrap (src/test)',
    'test helper module (.test-helper.ts)',
    'test module (.test.ts/.test.tsx)',
  ])
})

test('allows valid imports between test modules and shared test helpers', () => {
  const { root, files } = project({
    'src/features/finance/lib/import-file-security.test.ts': "import { ImportTestWorker } from './import-worker.test-helper'\n",
    'src/features/finance/lib/import-utils.test.ts': "import { ImportTestWorker } from './import-worker.test-helper'\n",
    'src/features/finance/lib/import-worker.test-helper.ts': 'export class ImportTestWorker {}\n',
  })
  const result = inspectImportBoundaries({ root, files })
  assert.deepEqual(result.violations, [])
  assert.equal(result.passed, true)
})

test('does not report production code that imports nothing test related', () => {
  const { root, files } = project({
    'src/features/crm/pages/client-contracts.tsx': "import { Button } from '@/components/ui/button'\nimport { useAuth } from '@/features/auth/auth-context'\n",
    'src/components/ui/button.tsx': 'export const Button = 1\n',
    'src/features/auth/auth-context.ts': 'export const useAuth = 1\n',
  })
  assert.deepEqual(findProductionImportViolations({ root, files }), [])
})

test('ignores mock and helper names that are not import paths', () => {
  const { root, files } = project({
    'src/features/crm/pages/client-form.tsx': "const mock = { name: 'fixture' }\nexport const label = mock.name + '__mocks__'\n",
  })
  assert.deepEqual(findProductionImportViolations({ root, files }), [])
})
