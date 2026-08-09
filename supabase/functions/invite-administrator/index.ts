import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleInviteAdministrator } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve((request) => {
  return handleInviteAdministrator(request, {
    url,
    serviceRoleKey,
    anonKey,
    createClient,
    logger: console,
  })
})
