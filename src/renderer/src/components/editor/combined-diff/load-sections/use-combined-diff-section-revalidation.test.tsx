// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ORCA_WORKTREE_FILE_CHANGE_EVENT } from '@/hooks/worktree-file-change-event'
import type { OpenFile } from '@/store/slices/editor'
import type { FsChangedPayload } from '../../../../../../shared/filesystem-entry-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { DiffSection } from '../../diff-section-types'
import { useCombinedDiffEntrySet } from '../resolve-changes/use-combined-diff-entry-set'
import { useCombinedDiffSectionLoadRegistry } from './combined-diff-section-load-registry'
import { useCombinedDiffSectionRetry } from './use-combined-diff-section-retry'
import { useCombinedDiffSectionRevalidation } from './use-combined-diff-section-revalidation'

const review: OpenFile = {
  id: 'combined',
  worktreeId: 'wt',
  filePath: '/repo',
  relativePath: 'Changes',
  language: 'plaintext',
  isDirty: false,
  mode: 'diff',
  diffSource: 'combined-uncommitted'
}

function renderReview(): ReturnType<typeof vi.fn> {
  const requestSectionReload = vi.fn()
  renderHook(() =>
    useCombinedDiffSectionRevalidation({
      file: review,
      gitStatusEntries: [],
      // Why: index 3 is mid-read; that read may predate the missed write.
      registry: {
        loadedIndicesRef: { current: new Set([0, 2]) },
        loadingIndicesRef: { current: new Set([2, 3]) }
      },
      requestSectionReload,
      sectionIndexByKeyRef: { current: new Map() },
      sectionEntries: [],
      // Why: snapshot-backed reviews skip status-driven reloads, so only the catch-up can refresh them.
      shouldAutoReloadFromGitStatus: false,
      treeMode: 'uncommitted'
    })
  )
  return requestSectionReload
}

function dispatch(payload: FsChangedPayload, runtimeEnvironmentId: string | null = null): void {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(ORCA_WORKTREE_FILE_CHANGE_EVENT, {
        detail: { payload, runtimeEnvironmentId }
      })
    )
  })
}

afterEach(cleanup)

function renderLiveReview(status: GitStatusEntry[]) {
  const file: OpenFile = { ...review, combinedAreaFilter: 'unstaged' }
  const registry = {
    loadedIndicesRef: {
      current: new Set(status.filter((entry) => entry.area === 'unstaged').map((_, index) => index))
    },
    loadingIndicesRef: { current: new Set<number>() }
  }
  const sectionsRef = { current: [] }
  const sectionIndexByKeyRef = { current: new Map<string, number>() }
  const requestSectionReload = vi.fn()
  const hook = renderHook(
    ({ entries }: { entries: GitStatusEntry[] }) => {
      const entrySet = useCombinedDiffEntrySet({
        file,
        gitStatusEntries: entries,
        liveBranchEntries: [],
        sectionsRef
      })
      const signature = useCombinedDiffSectionRevalidation({
        file,
        gitStatusEntries: entries,
        registry,
        requestSectionReload,
        sectionIndexByKeyRef,
        sectionEntries: entrySet.entries,
        shouldAutoReloadFromGitStatus: entrySet.shouldAutoReloadFromGitStatus,
        treeMode: entrySet.treeMode
      })
      return { signature, entrySignature: entrySet.entrySignature }
    },
    { initialProps: { entries: status } }
  )
  return { hook, requestSectionReload }
}

it.each([10, 100])(
  'invalidates only the affected path among %i loaded rows when another area changes',
  (count) => {
    const unstaged: GitStatusEntry[] = Array.from({ length: count }, (_, index) => ({
      path: `file-${index}.ts`,
      status: 'modified',
      area: 'unstaged',
      added: 1
    }))
    const staged: GitStatusEntry = { ...unstaged[3]!, area: 'staged' }
    const { hook, requestSectionReload } = renderLiveReview([...unstaged, staged])
    const before = hook.result.current

    hook.rerender({ entries: [...unstaged, { ...staged, added: 2 }] })

    // A filtered-out area's change leaves the restore key stable, so loaded rows survive.
    expect(hook.result.current.entrySignature).toBe(before.entrySignature)
    expect(hook.result.current.signature).not.toBe(before.signature)
    expect(requestSectionReload.mock.calls).toEqual([[3]])
  }
)

it('tracks other-area appearance, rename metadata and disappearance without reloading siblings', () => {
  const entries: GitStatusEntry[] = ['a.ts', 'b.ts'].map((path) => ({
    path,
    status: 'modified',
    area: 'unstaged'
  }))
  const { hook, requestSectionReload } = renderLiveReview(entries)
  const staged: GitStatusEntry = {
    path: 'a.ts',
    status: 'renamed',
    area: 'staged',
    oldPath: 'old.ts'
  }
  hook.rerender({ entries: [...entries, staged] })
  hook.rerender({ entries: [...entries, { ...staged, oldPath: 'older.ts', removed: 2 }] })
  hook.rerender({ entries })
  expect(requestSectionReload.mock.calls).toEqual([[0], [0], [0]])
})

it('does not invalidate loaded rows for unchanged, unrelated or reordered status records', () => {
  const entries: GitStatusEntry[] = ['a.ts', 'b.ts', 'c.ts'].map((path) => ({
    path,
    status: 'modified',
    area: 'unstaged'
  }))
  const staged: GitStatusEntry = { ...entries[0]!, area: 'staged' }
  const { hook, requestSectionReload } = renderLiveReview([...entries, staged])
  hook.rerender({ entries: [...entries.map((entry) => ({ ...entry })), staged] })
  hook.rerender({ entries: [staged, entries[2]!, entries[0]!, entries[1]!] })
  hook.rerender({
    entries: [...entries, staged, { path: 'unrelated.ts', area: 'staged', status: 'added' }]
  })
  expect(requestSectionReload).not.toHaveBeenCalled()
})

it('preserves dirty drafts and scopes in-flight, collapsed and offscreen retry bookkeeping', () => {
  const sections: DiffSection[] = Array.from({ length: 6 }, (_, index) => ({
    key: `unstaged:file-${index}.ts`,
    path: `file-${index}.ts`,
    area: 'unstaged',
    status: 'modified',
    originalContent: 'before',
    modifiedContent: 'after',
    collapsed: index === 3,
    dirty: index === 0,
    loading: false,
    diffResult: null,
    largeDiffRenderLimit: null
  }))
  const entries: GitStatusEntry[] = sections.map((section) => ({
    path: section.path,
    area: 'unstaged',
    status: 'modified'
  }))
  const invalidateViewStateCache = vi.fn()
  const setSections = vi.fn()
  const setSectionHeights = vi.fn()
  const sectionIndexByKeyRef = { current: new Map<string, number>() }
  const hook = renderHook(
    ({ status }: { status: GitStatusEntry[] }) => {
      const registry = useCombinedDiffSectionLoadRegistry(sections)
      const { requestSectionReload } = useCombinedDiffSectionRetry({
        invalidateViewStateCache,
        registry,
        setSections,
        setSectionHeights
      })
      useCombinedDiffSectionRevalidation({
        file: review,
        gitStatusEntries: status,
        registry,
        requestSectionReload,
        sectionIndexByKeyRef,
        sectionEntries: sections,
        shouldAutoReloadFromGitStatus: true,
        treeMode: 'uncommitted'
      })
      return registry
    },
    { initialProps: { status: entries } }
  )
  const registry = hook.result.current
  registry.loadedIndicesRef.current = new Set([0, 1, 2, 3, 4, 5])
  registry.loadingIndicesRef.current = new Set([1])
  registry.renderedIndicesRef.current = new Set([0, 1, 2, 3, 5])
  hook.rerender({
    status: [
      ...entries,
      ...entries
        .filter((_, index) => index !== 2)
        .map((entry) => ({ ...entry, area: 'staged' as const }))
    ]
  })
  expect([...registry.loadedIndicesRef.current]).toEqual([0, 2])
  expect([...registry.loadingIndicesRef.current]).toEqual([1])
  expect([...registry.sectionLoadTokensRef.current]).toEqual([
    [1, 1],
    [3, 1],
    [4, 1],
    [5, 1]
  ])
  expect([...registry.reloadTimersRef.current.keys()]).toEqual([5])
  expect(setSections).not.toHaveBeenCalled()
  expect(setSectionHeights).not.toHaveBeenCalled()
})

it('re-reads every loaded and in-flight section of a mounted review when its workspace catches up', () => {
  const requestSectionReload = renderReview()
  dispatch({
    worktreePath: '/repo',
    events: [{ kind: 'overflow', absolutePath: '/repo' }],
    resync: true
  })
  expect(requestSectionReload.mock.calls).toEqual([[0], [2], [3]])
})

it('ignores other workspaces, other hosts, path events and storm overflows', () => {
  const requestSectionReload = renderReview()
  const resync = (worktreePath: string): FsChangedPayload => ({
    worktreePath,
    events: [{ kind: 'overflow', absolutePath: worktreePath }],
    resync: true
  })
  dispatch(resync('/other'))
  dispatch(resync('/repo'), 'env-1')
  dispatch({
    worktreePath: '/repo',
    events: [{ kind: 'update', absolutePath: '/repo/a.ts' }]
  })
  // Storm overflow refreshes status only; rereading every section per flush would fan out.
  dispatch({
    worktreePath: '/repo',
    events: [{ kind: 'overflow', absolutePath: '/repo' }]
  })
  expect(requestSectionReload).not.toHaveBeenCalled()
})
