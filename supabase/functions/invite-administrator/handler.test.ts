import { describe, expect, it, vi } from 'vitest'
import { handleInviteAdministrator, type InviteAdministratorDependencies } from './handler'

function createDependencies(options: {
  provisionError?: string
  provisionRejection?: Error
  provisionData?: unknown
  inviteError?: string
  inviteRejection?: Error
  inviteUserId?: string | null
  authUsers?: Array<{ id: string; email?: string; user_metadata?: { administrator_provisioning_secret?: string } }>
  matchingAuthUser?: boolean
  recoveryData?: unknown
  recoveryError?: string
  cancelError?: string
  cancelRejection?: Error
  deleteError?: string
} = {}) {
  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: { user: options.inviteUserId === undefined ? { id: 'auth-user-id' } : options.inviteUserId === null ? null : { id: options.inviteUserId } },
    error: options.inviteError ? { message: options.inviteError } : null,
  })
  if (options.inviteRejection) inviteUserByEmail.mockRejectedValue(options.inviteRejection)
  const listUsers = vi.fn().mockImplementation(() => Promise.resolve({
    data: {
      users: options.matchingAuthUser
        ? [{ id: 'auth-user-id', email: 'new.admin@example.com', user_metadata: { administrator_provisioning_secret: inviteUserByEmail.mock.calls[0][1].data.administrator_provisioning_secret } }]
        : options.authUsers ?? [],
    },
    error: null,
  }))
  const deleteUser = vi.fn().mockResolvedValue({ error: options.deleteError ? { message: options.deleteError } : null })
  const service = { auth: { admin: { inviteUserByEmail, listUsers, deleteUser } } }
  const rpc = vi.fn((name: string) => {
    if (name === 'create_administrator_provisioning') {
      if (options.provisionRejection) return Promise.reject(options.provisionRejection)
      return Promise.resolve({ data: options.provisionError ? null : options.provisionData === undefined ? [{ id: '00000000-0000-4000-8000-000000000001' }] : options.provisionData, error: options.provisionError ? { message: options.provisionError } : null })
    }
    if (name === 'get_administrator_provisioning_recovery') {
      return Promise.resolve({ data: options.recoveryData ?? [{ id: '00000000-0000-4000-8000-000000000001', state: 'pending', consumed_user_id: null }], error: options.recoveryError ? { message: options.recoveryError } : null })
    }
    if (options.cancelRejection) return Promise.reject(options.cancelRejection)
    return Promise.resolve({ data: null, error: options.cancelError ? { message: options.cancelError } : null })
  })
  const caller = { rpc }
  const createClient = vi.fn((_url: string, key: string) => key === 'anon-key' ? caller : service)
  const logger = { error: vi.fn() }
  const dependencies: InviteAdministratorDependencies = {
    url: 'http://localhost', serviceRoleKey: 'service-role', anonKey: 'anon-key', createClient, logger,
  }
  return { dependencies, inviteUserByEmail, listUsers, deleteUser, rpc, logger }
}

function invitationRequest() {
  return new Request('http://localhost/functions/v1/invite-administrator', {
    method: 'POST',
    headers: { Authorization: 'Bearer master-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'new.admin@example.com', full_name: 'New Administrator' }),
  })
}

describe('handleInviteAdministrator', () => {
  it('stages a caller-authorized provisioning record before inviting the Auth user', async () => {
    const { dependencies, inviteUserByEmail, deleteUser, rpc } = createDependencies()

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 'auth-user-id' })
    const secret = rpc.mock.calls[0][1].p_secret
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(rpc).toHaveBeenCalledWith('create_administrator_provisioning', {
      p_email: 'new.admin@example.com', p_full_name: 'New Administrator', p_role: 'admin', p_secret: secret,
    })
    expect(inviteUserByEmail).toHaveBeenCalledWith('new.admin@example.com', {
      data: { full_name: 'New Administrator', administrator_provisioning_secret: secret },
    })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not call Auth when the caller-scoped provisioning RPC rejects', async () => {
    const { dependencies, inviteUserByEmail } = createDependencies({ provisionRejection: new Error('Master administrator access required') })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Master administrator access required' })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('cancels verified pending provisioning when the invitation fails before an Auth user exists', async () => {
    const { dependencies, rpc, logger } = createDependencies({ inviteError: 'Email delivery failed', inviteUserId: null })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Email delivery failed' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_administrator_provisioning_recovery', expect.objectContaining({ p_email: 'new.admin@example.com' }))
    expect(rpc).toHaveBeenLastCalledWith('cancel_administrator_provisioning', { p_provisioning_id: '00000000-0000-4000-8000-000000000001' })
    expect(logger.error).toHaveBeenCalledWith('Administrator invitation failed; provisioning was cancelled', expect.objectContaining({ provisioningId: '00000000-0000-4000-8000-000000000001' }))
  })

  it('does not delete an Auth user whose metadata does not match the pending provisioning', async () => {
    const { dependencies, deleteUser, rpc } = createDependencies({ inviteError: 'Invite response failed', authUsers: [{ id: 'auth-user-id', email: 'new.admin@example.com' }] })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(400)
    expect(deleteUser).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenLastCalledWith('cancel_administrator_provisioning', { p_provisioning_id: '00000000-0000-4000-8000-000000000001' })
  })

  it('deletes an Auth user only after its email and opaque secret match pending provisioning', async () => {
    const { dependencies, deleteUser, rpc } = createDependencies({ inviteError: 'Invite response failed', matchingAuthUser: true })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(400)
    expect(deleteUser).toHaveBeenCalledWith('auth-user-id')
    expect(rpc).toHaveBeenLastCalledWith('cancel_administrator_provisioning', { p_provisioning_id: '00000000-0000-4000-8000-000000000001' })
  })

  it('retains the committed Auth user and returns success when invite throws after the trigger consumes provisioning', async () => {
    const { dependencies, deleteUser, rpc } = createDependencies({
      inviteRejection: new Error('Gateway timeout'),
      matchingAuthUser: true,
      recoveryData: [{ id: '00000000-0000-4000-8000-000000000001', state: 'consumed', consumed_user_id: 'auth-user-id' }],
    })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 'auth-user-id' })
    expect(deleteUser).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenLastCalledWith('get_administrator_provisioning_recovery', expect.objectContaining({ p_email: 'new.admin@example.com' }))
  })

  it('reports compensation failure when verified provisioning cleanup fails', async () => {
    const { dependencies, logger } = createDependencies({ inviteError: 'Invite response failed', deleteError: 'Auth deletion failed', cancelError: 'Provisioning cancellation failed' })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Invite response failed', cleanup_error: 'Provisioning cancellation failed' })
    expect(logger.error).toHaveBeenCalledWith('Administrator invitation compensation failed', expect.objectContaining({ provisioningCleanupError: 'Provisioning cancellation failed' }))
  })

  it('cancels the matching pending provisioning when a successful response has no valid id', async () => {
    const { dependencies, inviteUserByEmail, rpc, logger } = createDependencies({ provisionData: [{}] })

    const response = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Administrator provisioning failed' })
    const secret = rpc.mock.calls[0][1].p_secret
    expect(rpc).toHaveBeenLastCalledWith('cancel_administrator_provisioning_by_secret', {
      p_email: 'new.admin@example.com', p_secret: secret,
    })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('Administrator provisioning response was incomplete; provisioning was cancelled')
  })

  it('permits a later retry after missing-id cleanup completes', async () => {
    const caller = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: [{}], error: null })
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: [{ id: '00000000-0000-4000-8000-000000000002' }], error: null }),
    }
    const inviteUserByEmail = vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null })
    const service = { auth: { admin: { inviteUserByEmail, deleteUser: vi.fn() } } }
    const dependencies: InviteAdministratorDependencies = {
      url: 'http://localhost', serviceRoleKey: 'service-role', anonKey: 'anon-key',
      createClient: vi.fn((_url: string, key: string) => key === 'anon-key' ? caller : service), logger: { error: vi.fn() },
    }

    const first = await handleInviteAdministrator(invitationRequest(), dependencies)
    const second = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(first.status).toBe(500)
    expect(second.status).toBe(201)
    expect(inviteUserByEmail).toHaveBeenCalledTimes(1)
    expect(caller.rpc.mock.calls.map(([name]) => name)).toEqual([
      'create_administrator_provisioning',
      'cancel_administrator_provisioning_by_secret',
      'create_administrator_provisioning',
    ])
  })

  it('permits a retry after a verified ambiguous failure cancels only its pending provisioning', async () => {
    const caller = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: [{ id: '00000000-0000-4000-8000-000000000001' }], error: null })
        .mockResolvedValueOnce({ data: [{ id: '00000000-0000-4000-8000-000000000001', state: 'pending', consumed_user_id: null }], error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: [{ id: '00000000-0000-4000-8000-000000000002' }], error: null }),
    }
    const inviteUserByEmail = vi.fn()
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'Gateway timeout' } })
      .mockResolvedValueOnce({ data: { user: { id: 'retry-auth-user-id' } }, error: null })
    const service = { auth: { admin: { inviteUserByEmail, listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }), deleteUser: vi.fn() } } }
    const dependencies: InviteAdministratorDependencies = {
      url: 'http://localhost', serviceRoleKey: 'service-role', anonKey: 'anon-key',
      createClient: vi.fn((_url: string, key: string) => key === 'anon-key' ? caller : service), logger: { error: vi.fn() },
    }

    const first = await handleInviteAdministrator(invitationRequest(), dependencies)
    const second = await handleInviteAdministrator(invitationRequest(), dependencies)

    expect(first.status).toBe(400)
    expect(second.status).toBe(201)
    expect(caller.rpc.mock.calls.map(([name]) => name)).toEqual([
      'create_administrator_provisioning',
      'get_administrator_provisioning_recovery',
      'cancel_administrator_provisioning',
      'create_administrator_provisioning',
    ])
  })
})
