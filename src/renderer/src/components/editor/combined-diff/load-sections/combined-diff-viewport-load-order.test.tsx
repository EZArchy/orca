// @vitest-environment happy-dom

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'
import type { GitDiffResult } from '../../../../../../shared/git-diff-compare-types'
import type { DiffSection } from '../../diff-section-types'
import type { CombinedDiffEntrySet } from '../resolve-changes/use-combined-diff-entry-set'
import { useCombinedDiffSectionLoadRegistry } from './combined-diff-section-load-registry'
import { useCombinedDiffSectionLoader } from './use-combined-diff-section-loader'
import { useCombinedDiffSectionRetry } from './use-combined-diff-section-retry'

const transport = vi.hoisted(() => ({ diff: vi.fn() }))
vi.mock('@/runtime/runtime-git-diff-client', () => ({
  getRuntimeGitDiff: transport.diff,
  getRuntimeGitBranchDiff: transport.diff,
  getRuntimeGitCommitDiff: transport.diff
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/lib/file-owner-runtime-target', () => ({
  requireRuntimeTargetForFileOwner: () => ({ kind: 'local' })
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionIdForFile: () => undefined }))

const file: OpenFile = {
  id: 'review',
  filePath: '/repo',
  relativePath: 'review',
  worktreeId: 'workspace',
  language: 'plaintext',
  isDirty: false,
  mode: 'diff',
  diffSource: 'combined-uncommitted'
}

function useReview({ count, rendered }: { count: number; rendered: number[] }) {
  const entrySet = useMemo<CombinedDiffEntrySet>(() => {
    const entries = Array.from({ length: count }, (_, index) => ({
      path: `${index}.ts`,
      status: 'modified' as const,
      area: 'unstaged' as const
    }))
    return {
      entries,
      uncommittedEntries: entries,
      allEntries: entries,
      commitEntries: [],
      renderableBranchEntries: [],
      branchCompare: null,
      commitCompare: null,
      entrySignature: `${count}`,
      hasUncommittedEntriesSnapshot: true,
      shouldAutoReloadFromGitStatus: false,
      isAllMode: false,
      isBranchMode: false,
      isCommitMode: false,
      treeMode: 'uncommitted'
    }
  }, [count])
  const [sections, setSections] = useState<DiffSection[]>(() =>
    entrySet.entries.map((entry) => ({
      ...entry,
      key: entry.path,
      originalContent: '',
      modifiedContent: '',
      collapsed: false,
      loading: true,
      dirty: false,
      diffResult: null,
      largeDiffRenderLimit: null
    }))
  )
  const [, setSectionHeights] = useState<Record<number, number>>({})
  const registry = useCombinedDiffSectionLoadRegistry(sections)
  const loader = useCombinedDiffSectionLoader({
    entrySet,
    file,
    registry,
    sectionCount: count,
    setSectionHeights,
    setSections
  })
  const retry = useCombinedDiffSectionRetry({
    invalidateViewStateCache: () => {},
    registry,
    setSectionHeights,
    setSections
  })
  useLayoutEffect(() => {
    registry.renderedIndicesRef.current = new Set(rendered)
  }, [registry.renderedIndicesRef, rendered])
  const { loadSection } = loader
  useEffect(() => {
    for (const index of rendered) {
      loadSection(index)
    }
  }, [loadSection, rendered])
  return { sections, registry, loader, retry, setSections }
}

function captureReads() {
  const started: string[] = []
  const pending = new Map<string, () => void>()
  let active = 0
  let peakActive = 0
  transport.diff.mockImplementation((_scope: unknown, request: { filePath: string }) => {
    started.push(request.filePath)
    active += 1
    peakActive = Math.max(peakActive, active)
    return new Promise<GitDiffResult>((resolve) => {
      pending.set(request.filePath, () => {
        pending.delete(request.filePath)
        active -= 1
        resolve({
          kind: 'text',
          originalContent: `before ${request.filePath}`,
          modifiedContent: `after ${request.filePath}`,
          originalIsBinary: false,
          modifiedIsBinary: false
        })
      })
    })
  })
  const settle = async (path: string): Promise<void> => {
    expect(pending.has(path)).toBe(true)
    await act(async () => pending.get(path)?.())
  }
  return { started, pending, peakActive: () => peakActive, settle }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('combined diff viewport admission through section fetch', () => {
  it.each([10, 100])(
    'loads the current row next after %i queued viewport requests',
    async (count) => {
      const reads = captureReads()
      const hook = renderHook(useReview, { initialProps: { count: count + 6, rendered: [0] } })
      await act(async () => {})
      expect(reads.started).toEqual(['0.ts'])

      for (let index = 6; index < count + 6; index += 1) {
        hook.rerender({ count: count + 6, rendered: [index] })
      }
      await reads.settle('0.ts')
      const currentPath = `${count + 5}.ts`
      expect(reads.started).toEqual(['0.ts', currentPath])
      await reads.settle(currentPath)
      expect(hook.result.current.sections[count + 5]?.modifiedContent).toBe(`after ${currentPath}`)

      for (let index = 1; index < 6; index += 1) {
        await reads.settle(`${index}.ts`)
      }
      expect(reads.started).toEqual(['0.ts', currentPath, '1.ts', '2.ts', '3.ts', '4.ts', '5.ts'])
      expect(reads.peakActive()).toBe(1)

      hook.rerender({ count: count + 6, rendered: [6] })
      await act(async () => {})
      await reads.settle('6.ts')
      expect(hook.result.current.sections[6]?.modifiedContent).toBe('after 6.ts')
      expect(reads.pending.size).toBe(0)
    }
  )

  it('retains explicit navigation, deferred loads and manual retries after scrolling away', async () => {
    const reads = captureReads()
    const hook = renderHook(useReview, { initialProps: { count: 10, rendered: [0] } })
    await act(async () => {})
    hook.rerender({ count: 10, rendered: [6] })
    act(() => hook.result.current.retry.ensureSectionLoaded(6))
    act(() => {
      hook.result.current.setSections((sections) =>
        sections.map((section, index) =>
          index === 7 ? { ...section, loadOnDemand: true } : section
        )
      )
    })
    act(() => hook.result.current.loader.loadDeferredSection(7))
    act(() => hook.result.current.retry.retrySection(8))
    hook.rerender({ count: 10, rendered: [9] })
    await reads.settle('0.ts')
    expect(reads.started).toEqual(['0.ts', '9.ts'])
    await reads.settle('9.ts')
    for (let index = 1; index < 9; index += 1) {
      await reads.settle(`${index}.ts`)
    }
    expect(reads.started).toContain('6.ts')
    expect(reads.started).toContain('7.ts')
    expect(hook.result.current.sections[7]?.modifiedContent).toBe('after 7.ts')
    expect(hook.result.current.sections[8]?.modifiedContent).toBe('after 8.ts')
    expect(reads.peakActive()).toBe(1)
  })

  it('skips a collapsed rendered row and loads it on explicit expansion', async () => {
    const reads = captureReads()
    const hook = renderHook(useReview, { initialProps: { count: 8, rendered: [0] } })
    await act(async () => {})
    hook.rerender({ count: 8, rendered: [6, 7] })
    act(() =>
      hook.result.current.setSections((sections) =>
        sections.map((section, index) => (index === 6 ? { ...section, collapsed: true } : section))
      )
    )
    await reads.settle('0.ts')
    expect(reads.started).toEqual(['0.ts', '7.ts'])
    await reads.settle('7.ts')
    for (let index = 1; index < 6; index += 1) {
      await reads.settle(`${index}.ts`)
    }
    expect(reads.started).not.toContain('6.ts')
    await act(async () => {
      hook.result.current.setSections((sections) =>
        sections.map((section, index) => (index === 6 ? { ...section, collapsed: false } : section))
      )
      hook.result.current.registry.loadSchedulerRef.current.request(6)
    })
    await reads.settle('6.ts')
    expect(hook.result.current.sections[6]?.modifiedContent).toBe('after 6.ts')
    expect(reads.peakActive()).toBe(1)
  })

  it('drops an automatic reload that leaves the viewport while queued, then refreshes on return', async () => {
    vi.useFakeTimers()
    const reads = captureReads()
    const hook = renderHook(useReview, { initialProps: { count: 8, rendered: [6] } })
    await act(async () => {})
    await reads.settle('6.ts')
    expect(reads.started).toEqual(['6.ts', '0.ts'])
    act(() => hook.result.current.retry.requestSectionReload(6))
    await act(async () => vi.advanceTimersByTime(300))
    hook.rerender({ count: 8, rendered: [7] })
    await reads.settle('0.ts')
    await reads.settle('7.ts')
    for (let index = 1; index < 6; index += 1) {
      await reads.settle(`${index}.ts`)
    }
    expect(reads.started.filter((path) => path === '6.ts')).toHaveLength(1)
    hook.rerender({ count: 8, rendered: [6] })
    await act(async () => {})
    await reads.settle('6.ts')
    expect(reads.started.filter((path) => path === '6.ts')).toHaveLength(2)
    expect(reads.peakActive()).toBe(1)
  })
})
