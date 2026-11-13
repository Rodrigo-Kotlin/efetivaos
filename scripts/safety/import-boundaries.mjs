import { readFileSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

function isTestFile(relativePath) {
  const name = relativePath.split('/').pop() ?? ''
  return /\.test\.(ts|tsx)$/.test(name) || /\.spec\.(ts|tsx)$/.test(name) || /\.test-helper\.(ts|tsx)$/.test(name)
}

export function classifyForbiddenTarget(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  const segments = normalized.split('/')
  const fileName = segments[segments.length - 1] ?? ''

  if (segments.includes('__mocks__')) return 'mock directory (__mocks__)'
  if (segments.includes('__test-utils__')) return 'test utility directory (__test-utils__)'
  if (normalized.startsWith('src/test/')) return 'shared test bootstrap (src/test)'
  if (normalized === 'src/test' || normalized.startsWith('src/test/')) return 'shared test bootstrap (src/test)'
  if (normalized === 'e2e' || normalized.startsWith('e2e/')) return 'end-to-end suite (e2e)'
  if (/\.test\.(ts|tsx)$/.test(fileName)) return 'test module (.test.ts/.test.tsx)'
  if (/\.spec\.(ts|tsx)$/.test(fileName)) return 'test module (.spec.ts/.spec.tsx)'
  if (/\.test-helper\.(ts|tsx)$/.test(fileName)) return 'test helper module (.test-helper.ts)'
  return null
}

export function resolveImportSpecifier(importerPath, specifier) {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`
  if (specifier.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(importerPath), specifier))
  return null
}

function resolveToFile(candidate, repositoryFiles) {
  const attempts = [
    candidate,
    ...SOURCE_EXTENSIONS.map(extension => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map(extension => `${candidate}/index${extension}`),
  ]
  return attempts.find(attempt => repositoryFiles.has(attempt)) ?? null
}

export function collectImports(source, filePath) {
  const parsed = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
  const specifiers = []
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return specifiers
}

/**
 * Fails closed only for production sources. Test modules may import other test
 * modules and shared test helpers without being reported.
 */
export function findProductionImportViolations({ root, files }) {
  const repositoryFiles = new Set(files.map(file => file.replace(/\\/g, '/')))
  const violations = []

  for (const file of files) {
    const relative = file.replace(/\\/g, '/')
    if (relative.startsWith('src/') === false) continue
    if (isTestFile(relative)) continue

    const absolute = path.join(root, relative)
    let source
    try {
      source = readFileSync(absolute, 'utf8')
    } catch {
      continue
    }

    for (const specifier of collectImports(source, relative)) {
      const candidate = resolveImportSpecifier(relative, specifier)
      if (!candidate) continue
      const resolved = resolveToFile(candidate, repositoryFiles)
      const inspected = resolved ?? candidate
      const reason = classifyForbiddenTarget(inspected)
      if (!reason) continue
      violations.push({ file: relative, specifier, resolvedTarget: resolved ?? inspected, reason })
    }
  }

  return violations
}

export function inspectImportBoundaries({ root, files }) {
  const violations = findProductionImportViolations({ root, files })
  return {
    productionFilesChecked: files.filter(file => file.replace(/\\/g, '/').startsWith('src/')).length,
    violations,
    passed: violations.length === 0,
  }
}
