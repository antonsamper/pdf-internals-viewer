import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

// Version 11 removed APIs such as makeRe(). Only these inspected consumers
// are overridden; they use minimatch(), Minimatch.match(), and pattern.
const fromEslint = createRequire(require.resolve('eslint'))
const fromTypescriptEslint = createRequire(require.resolve('typescript-eslint'))
const consumers = [
  ['eslint', require.resolve('eslint')],
  ['@eslint/config-array', fromEslint.resolve('@eslint/config-array')],
  ['@typescript-eslint/typescript-estree', fromTypescriptEslint.resolve('@typescript-eslint/typescript-estree')],
]

describe.each(consumers)('%s scoped glob compatibility', (_consumer, entry) => {
  const fromConsumer = createRequire(entry)
  const { Minimatch, minimatch } = fromConsumer('minimatch')

  it('resolves the reviewed patched release', () => {
    expect(fromConsumer('minimatch/package.json').version).toBe('11.0.7')
  })
  it('preserves recursive TS/TSX matching and partial-directory traversal used by ESLint', () => {
    const matcher = new Minimatch('src/**/*.{ts,tsx}', { dot: true })
    expect(matcher.pattern).toBe('src/**/*.{ts,tsx}')
    expect(matcher.match('src/App.tsx')).toBe(true)
    expect(matcher.match('src/lib/pdf/inspector.ts')).toBe(true)
    expect(matcher.match('src/styles/shadcn.css')).toBe(false)
    expect(matcher.match('src/lib', true)).toBe(true)
    expect(matcher.match('public', true)).toBe(false)
  })
  it('preserves hidden files and project-service allowlist matching', () => {
    expect(minimatch('.config.ts', '*.ts', { dot: true })).toBe(true)
    expect(minimatch('.config.ts', '*.ts', { dot: false })).toBe(false)
    expect(minimatch('src/App.tsx', '*.ts', { dot: true })).toBe(false)
    expect(minimatch('vite.config.ts', '*.config.ts', { dot: true })).toBe(true)
  })
  it('preserves ignored-directory and negated matching semantics', () => {
    const matcher = new Minimatch('!src/generated/**', { dot: true })
    expect(matcher.match('src/App.tsx')).toBe(true)
    expect(matcher.match('src/generated/libpdf-inspection.mjs')).toBe(false)
    const flipped = new Minimatch('!src/generated/**', { dot: true, flipNegate: true })
    expect(flipped.match('src/generated/libpdf-inspection.mjs')).toBe(true)
    expect(flipped.match('src/App.tsx')).toBe(false)
  })
})
