/// <reference types="vitest" />
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLevels } from '../useLevels'

const levels = [
  { id: 'l1', code: 'A1', name: 'A1', min_score: 0, max_score: 20, description: null, version: 1, is_active: true, supersedes_level_id: null },
  { id: 'l2', code: 'A2', name: 'A2', min_score: 21, max_score: 100, description: null, version: 1, is_active: true, supersedes_level_id: null },
]

function chain(data: unknown, error: unknown = null) {
  const value: Record<string, any> = {}
  ;['select', 'eq', 'order', 'single'].forEach((method) => { value[method] = vi.fn().mockReturnValue(value) })
  value.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve)
  return value
}

let from: ReturnType<typeof vi.fn>
let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { from, rpc } } }))

beforeEach(() => {
  vi.clearAllMocks()
  from = vi.fn((table: string) => table === 'level_partition_revision' ? chain({ revision: 7 }) : chain(levels))
  rpc = vi.fn()
})

describe('useLevels', () => {
  it('loads active levels and the revision as one distribution', async () => {
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeDistribution).toEqual({
      revision: 7,
      levels: levels.map(({ id, min_score, max_score }) => ({ id, min_score, max_score })),
    })
  })

  it('keeps historical rows out of the active distribution', async () => {
    const historical = { ...levels[0], id: 'old', is_active: false, version: 1 }
    from = vi.fn((table: string) => table === 'level_partition_revision' ? chain({ revision: 7 }) : chain([historical, ...levels]))
    const { result } = renderHook(() => useLevels({ includeHistorical: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.levels).toHaveLength(3)
    expect(result.current.activeDistribution?.levels).not.toContainEqual(expect.objectContaining({ id: 'old' }))
  })

  it('sends the complete distribution and expected revision through one RPC', async () => {
    rpc.mockResolvedValue({ data: { revision: 8, deactivated_level_id: 'l2' }, error: null })
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let response
    await act(async () => { response = await result.current.replaceActiveLevelDistribution!({ expected_revision: 7, deactivate_level_id: 'l2', levels: [{ id: 'l1', min_score: 0, max_score: 100 }] }) })
    expect(response).toMatchObject({ data: { revision: 8, deactivated_level_id: 'l2', before: { revision: 7 }, after: { revision: 8, levels: [{ id: 'l1', min_score: 0, max_score: 100 }] } }, error: null })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('replace_active_level_distribution', {
      p_expected_revision: 7,
      p_levels: [{ id: 'l1', min_score: 0, max_score: 100 }],
      p_deactivate_level_id: 'l2',
    })
  })

  it('types stale revision as a conflict and refetches', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Level distribution revision is stale', code: '40001' } })
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { expect(await result.current.replaceActiveLevelDistribution!({ expected_revision: 6, levels: [], deactivate_level_id: 'l1' })).toEqual({ data: null, error: 'Level distribution revision is stale', code: '40001', conflict: true }) })
    await waitFor(() => expect(from).toHaveBeenCalledTimes(4))
  })

  it('does not expose a standalone deactivation API or report null RPC data as success', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).not.toHaveProperty('deactivateLevel')
    await act(async () => { expect(await result.current.replaceActiveLevelDistribution!({ expected_revision: 7, levels: [] })).toEqual({ data: null, error: 'Mutation returned no data' }) })
  })

  it('keeps metadata editing on its dedicated RPC', async () => {
    const updated = { ...levels[0], name: 'Elementary' }
    rpc.mockResolvedValue({ data: updated, error: null })
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { expect(await result.current.updateLevelMetadata!({ level_id: 'l1', name: 'Elementary', description: null })).toEqual({ data: updated, error: null }) })
    expect(rpc).toHaveBeenCalledWith('update_level_metadata', { p_level_id: 'l1', p_name: 'Elementary', p_description: null })
  })

  it('preserves metadata mutation and exposes read failures', async () => {
    from = vi.fn(() => chain(null, { message: 'network error' }))
    const { result } = renderHook(() => useLevels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network error')
    expect(result.current.levels).toEqual([])
  })
})
