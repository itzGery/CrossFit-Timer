import { resolve } from 'node:path'
import type { AppOptions } from './app.js'

export function getAppOptions(sessionStore?: AppOptions['sessionStore']): AppOptions {
  const production = process.env.NODE_ENV === 'production'
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const sessionSecret = process.env.SESSION_SECRET
  const allowedGoogleDomain = process.env.ALLOWED_GOOGLE_DOMAIN
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? (production ? undefined : 'http://localhost:5173')
  const sessionDirectory = process.env.SESSION_DIR ?? (production ? undefined : './sessions')

  if (!googleClientId || !sessionSecret || sessionSecret.length < 32 ||
      allowedGoogleDomain !== 'yaqbot.com' || !frontendOrigin || (!sessionStore && !sessionDirectory)) {
    throw new Error('Set GOOGLE_CLIENT_ID, a SESSION_SECRET of at least 32 characters, ALLOWED_GOOGLE_DOMAIN=yaqbot.com, FRONTEND_ORIGIN, and session storage.')
  }

  const origin = new URL(frontendOrigin)
  if (production && origin.protocol !== 'https:') {
    throw new Error('FRONTEND_ORIGIN must use HTTPS in production.')
  }

  return {
    googleClientId,
    sessionSecret,
    allowedGoogleDomain,
    frontendOrigin: origin.origin,
    sessionDirectory: sessionDirectory ? resolve(sessionDirectory) : undefined,
    sessionStore,
    production,
    nodeEnv: process.env.NODE_ENV,
    devAllowedEmail: process.env.DEV_ALLOWED_EMAIL,
    allowProductionTestGmail: process.env.ALLOW_PRODUCTION_TEST_GMAIL === 'true',
  }
}
