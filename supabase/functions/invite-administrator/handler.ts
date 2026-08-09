export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

type AuthError = { message: string } | null
type RpcResult = { data: unknown; error: AuthError }
type AuthUser = { id: string; email?: string | null; user_metadata?: { administrator_provisioning_secret?: unknown } | null }
type ProvisioningRecovery = { id: string; state: 'pending' | 'consumed'; consumed_user_id: string | null }

type SupabaseClient = {
  auth: {
    admin: {
      inviteUserByEmail: (email: string, options: { data: { full_name: string; administrator_provisioning_secret: string } }) => Promise<{ data: { user: { id: string } | null }; error: AuthError }>
      listUsers: (parameters: { page: number; perPage: number }) => Promise<{ data: { users: AuthUser[] }; error: AuthError }>
      deleteUser: (id: string) => Promise<{ error: AuthError }>
    }
  }
  rpc: (functionName: string, parameters: Record<string, string>) => Promise<RpcResult>
}

export type InviteAdministratorDependencies = {
  url: string
  serviceRoleKey: string
  anonKey: string
  createClient: (url: string, key: string, options?: { global: { headers: { Authorization: string } } }) => SupabaseClient
  logger: Pick<Console, 'error'>
}

function json(payload: Record<string, string>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isInvitationBody(body: unknown): body is { email: string; full_name: string } {
  return typeof body === 'object' && body !== null
    && typeof (body as Record<string, unknown>).email === 'string'
    && typeof (body as Record<string, unknown>).full_name === 'string'
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

function provisioningId(data: unknown): string | null {
  if (Array.isArray(data)) return provisioningId(data[0])
  const id = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).id : null
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null
}

function recovery(data: unknown): ProvisioningRecovery | null {
  if (Array.isArray(data)) return recovery(data[0])
  if (typeof data !== 'object' || data === null) return null
  const value = data as Record<string, unknown>
  const id = provisioningId(value)
  const state = value.state
  const consumedUserId = value.consumed_user_id
  return id && (state === 'pending' || state === 'consumed') && (typeof consumedUserId === 'string' || consumedUserId === null)
    ? { id, state, consumed_user_id: consumedUserId }
    : null
}

function provisioningSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function cancelProvisioning(caller: SupabaseClient, id: string) {
  try {
    const { error } = await caller.rpc('cancel_administrator_provisioning', { p_provisioning_id: id })
    return error?.message ?? null
  } catch (error) {
    return errorMessage(error, 'Administrator provisioning cleanup failed')
  }
}

async function cancelProvisioningBySecret(caller: SupabaseClient, email: string, secret: string) {
  try {
    const { error } = await caller.rpc('cancel_administrator_provisioning_by_secret', { p_email: email, p_secret: secret })
    return error?.message ?? null
  } catch (error) {
    return errorMessage(error, 'Administrator provisioning cleanup failed')
  }
}

async function lookupRecovery(caller: SupabaseClient, email: string, secret: string) {
  try {
    const { data, error } = await caller.rpc('get_administrator_provisioning_recovery', { p_email: email, p_secret: secret })
    return { data: error ? null : recovery(data), error: error?.message ?? null }
  } catch (error) {
    return { data: null, error: errorMessage(error, 'Administrator provisioning recovery failed') }
  }
}

async function lookupProvisionedAuthUser(service: SupabaseClient, email: string, secret: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    for (let page = 1; ; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return { user: null, error: error.message }
      const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail && candidate.user_metadata?.administrator_provisioning_secret === secret)
      if (user) return { user, error: null }
      if (data.users.length < 1000) return { user: null, error: null }
    }
  } catch (error) {
    return { user: null, error: errorMessage(error, 'Auth user recovery failed') }
  }
}

export async function handleInviteAdministrator(request: Request, dependencies: InviteAdministratorDependencies) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Authentication required' }, 401)

  const body = await request.json().catch(() => null)
  if (!isInvitationBody(body)) return json({ error: 'Administrator data is invalid' }, 400)

  // This caller-scoped RPC is the sole authentication and authorization boundary.
  const caller = dependencies.createClient(dependencies.url, dependencies.anonKey, { global: { headers: { Authorization: authorization } } })
  const secret = provisioningSecret()
  let provisionData: unknown
  try {
    const { data, error } = await caller.rpc('create_administrator_provisioning', {
      p_email: body.email,
      p_full_name: body.full_name,
      p_role: 'admin',
      p_secret: secret,
    })
    if (error) return json({ error: error.message }, 403)
    provisionData = data
  } catch (error) {
    return json({ error: errorMessage(error, 'Administrator provisioning failed') }, 403)
  }

  const id = provisioningId(provisionData)
  if (!id) {
    const cleanupError = await cancelProvisioningBySecret(caller, body.email, secret)
    if (cleanupError) {
      dependencies.logger.error('Administrator provisioning response cleanup failed', { cleanupError })
      return json({ error: 'Administrator provisioning failed', cleanup_error: cleanupError }, 500)
    }
    dependencies.logger.error('Administrator provisioning response was incomplete; provisioning was cancelled')
    return json({ error: 'Administrator provisioning failed' }, 500)
  }

  const service = dependencies.createClient(dependencies.url, dependencies.serviceRoleKey)
  let invitation: { user: { id: string } | null } | null = null
  let invitationError: string | null = null
  try {
    const result = await service.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.full_name, administrator_provisioning_secret: secret },
    })
    invitation = result.data
    invitationError = result.error?.message ?? (result.data.user ? null : 'Invitation failed')
  } catch (error) {
    invitationError = errorMessage(error, 'Invitation failed')
  }
  if (!invitationError) return json({ id: invitation!.user!.id }, 201)

  // A thrown or timed-out Auth call can still have committed the user and trigger.
  // Never compensate until both systems identify the same caller-owned provisioning.
  const authLookup = await lookupProvisionedAuthUser(service, body.email, secret)
  const provisioningLookup = await lookupRecovery(caller, body.email, secret)
  if (authLookup.error || provisioningLookup.error || !provisioningLookup.data) {
    dependencies.logger.error('Administrator invitation recovery could not be verified; provisioning was retained', {
      invitationError,
      authLookupError: authLookup.error,
      provisioningLookupError: provisioningLookup.error,
    })
    return json({ error: invitationError }, 500)
  }

  const recovered = provisioningLookup.data
  if (recovered.state === 'consumed') {
    if (authLookup.user?.id === recovered.consumed_user_id) return json({ id: recovered.consumed_user_id }, 201)
    dependencies.logger.error('Administrator invitation recovery found inconsistent committed identities; provisioning was retained', {
      invitationError,
      provisioningId: recovered.id,
      consumedUserId: recovered.consumed_user_id,
      authUserId: authLookup.user?.id,
    })
    return json({ error: invitationError }, 500)
  }

  const authUserId = authLookup.user?.id
  let authCleanupError: string | null = null
  if (authUserId) {
    try {
      const { error } = await service.auth.admin.deleteUser(authUserId)
      authCleanupError = error?.message ?? null
    } catch (error) {
      authCleanupError = errorMessage(error, 'Auth user cleanup failed')
    }
  }
  const provisioningCleanupError = await cancelProvisioning(caller, id)
  if (authCleanupError || provisioningCleanupError) {
    dependencies.logger.error('Administrator invitation compensation failed', {
      authUserId,
      invitationError,
      authCleanupError,
      provisioningCleanupError,
    })
    return json({ error: invitationError, cleanup_error: authCleanupError ?? provisioningCleanupError! }, 500)
  }

  dependencies.logger.error('Administrator invitation failed; provisioning was cancelled', {
    authUserId,
    invitationError,
    provisioningId: id,
  })
  return json({ error: invitationError }, 400)
}
