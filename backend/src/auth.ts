import { OAuth2Client, type TokenPayload } from 'google-auth-library'

export type Coach = { sub: string; email: string }
export type GoogleTokenVerifier = (credential: string, audience: string) => Promise<TokenPayload | undefined>

export const verifyGoogleIdToken: GoogleTokenVerifier = async (credential, audience) => {
  const client = new OAuth2Client()
  const ticket = await client.verifyIdToken({ idToken: credential, audience })
  return ticket.getPayload()
}

type AuthResult =
  | { status: 200; coach: Coach; workspaceCoach: boolean }
  | { status: 401 | 403; error: string }

export async function authenticateGoogleCredential(
  credential: string,
  clientId: string,
  allowedDomain: string,
  verifier: GoogleTokenVerifier = verifyGoogleIdToken,
  developmentAllowedEmail?: string,
): Promise<AuthResult> {
  let payload: TokenPayload | undefined
  try {
    payload = await verifier(credential, clientId)
  } catch {
    return { status: 401, error: 'Invalid or expired Google sign-in.' }
  }

  // The library verifies the signature and audience. Check these claims explicitly
  // as well so the authorization decision is clear and testable.
  if (!payload || payload.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) ||
      !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) {
    return { status: 401, error: 'Invalid or expired Google sign-in.' }
  }

  const email = payload.email?.toLowerCase()
  if (payload.email_verified !== true || !email || !payload.sub) {
    return { status: 403, error: `Only verified @${allowedDomain} Workspace accounts can sign in.` }
  }

  const isWorkspaceCoach = payload.hd === allowedDomain && email.endsWith(`@${allowedDomain}`)
  // A personal account is allowed only when the server explicitly enables the local development exception.
  const isDevelopmentCoach = developmentAllowedEmail !== undefined &&
    email === developmentAllowedEmail.toLowerCase()
  if (!isWorkspaceCoach && !isDevelopmentCoach) {
    return { status: 403, error: `Only verified @${allowedDomain} Workspace accounts can sign in.` }
  }

  return { status: 200, coach: { sub: payload.sub, email }, workspaceCoach: isWorkspaceCoach }
}
