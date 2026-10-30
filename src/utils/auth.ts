export type Credential = { access_token: string; expire_at: number }
const STORAGE_KEY = 'llmops.credential'
export const SESSION_CLEARED_EVENT = 'llmops:session-cleared'

export const clearCredential = () => {
  sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))
}

export const setCredential = (credential: Credential) => {
  if (
    !credential ||
    typeof credential.access_token !== 'string' ||
    !credential.access_token ||
    !Number.isFinite(credential.expire_at) ||
    credential.expire_at <= Date.now() / 1000
  ) {
    throw new Error('The server returned an invalid or expired login credential.')
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
}

export const getAccessToken = (): string | null => {
  try {
    const credential = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || 'null',
    ) as Credential | null
    if (
      credential &&
      typeof credential.access_token === 'string' &&
      credential.access_token &&
      Number.isFinite(credential.expire_at) &&
      credential.expire_at > Date.now() / 1000
    ) {
      return credential.access_token
    }
  } catch {
    // Corrupt browser state is treated as signed out.
  }
  sessionStorage.removeItem(STORAGE_KEY)
  return null
}

export const isLogin = () => getAccessToken() !== null
