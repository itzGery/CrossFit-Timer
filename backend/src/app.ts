import { mkdirSync } from 'node:fs'
import express, { type RequestHandler } from 'express'
import session from 'express-session'
import FileStoreFactory from 'session-file-store'
import { authenticateGoogleCredential, type GoogleTokenVerifier } from './auth.js'
import { parseWorkoutConfig, workoutPath } from './workout.js'

const SESSION_COOKIE_NAME = 'yaqbot.sid'
const DEFAULT_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

export type AppOptions = {
  googleClientId: string
  allowedGoogleDomain: string
  sessionSecret: string
  sessionDirectory?: string
  sessionStore?: session.Store
  frontendOrigin: string
  production: boolean
  nodeEnv?: string
  devAllowedEmail?: string
  sessionMaxAgeMs?: number
  sessionReapIntervalSeconds?: number
  verifyGoogleToken?: GoogleTokenVerifier
}

export function createApp(options: AppOptions) {
  const app = express()
  let store = options.sessionStore
  if (!store) {
    if (!options.sessionDirectory) throw new Error('A session store or session directory is required.')
    const FileStore = FileStoreFactory(session)
    mkdirSync(options.sessionDirectory, { recursive: true, mode: 0o700 })
    const fileStore = new FileStore({
      path: options.sessionDirectory,
      secret: options.sessionSecret,
      ttl: Math.ceil((options.sessionMaxAgeMs ?? DEFAULT_SESSION_MAX_AGE_MS) / 1000),
      reapInterval: options.sessionReapIntervalSeconds ?? 3600,
      retries: 0,
    })
    // FileStore.touch rewrites the file after reads and can race with logout.
    // Sessions have a fixed lifetime, so reads do not need to extend the TTL.
    fileStore.touch = (_sessionId, _sessionData, callback) => callback?.()
    store = fileStore
  }

  const localHostnames = ['localhost', '127.0.0.1', '[::1]']
  const localDevelopment = options.nodeEnv === 'development' && !options.production &&
    localHostnames.includes(new URL(options.frontendOrigin).hostname)

  app.disable('x-powered-by')
  app.set('trust proxy', options.production ? 1 : false)
  app.use(express.json({ limit: '8kb' }))
  app.use(session({
    name: SESSION_COOKIE_NAME,
    secret: options.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: options.production,
      sameSite: 'lax',
      maxAge: options.sessionMaxAgeMs ?? DEFAULT_SESSION_MAX_AGE_MS,
      path: '/',
    },
  }))

  const requireSameOrigin: RequestHandler = (request, response, next) => {
    if (request.get('origin') !== options.frontendOrigin) {
      response.status(403).json({ error: 'Request origin is not allowed.' })
      return
    }
    next()
  }

  const requireCoach: RequestHandler = (request, response, next) => {
    if (!request.session.coach || (options.production && request.session.workspaceCoach !== true)) {
      response.status(401).json({ error: 'Sign in with an authorized coach account.' })
      return
    }
    next()
  }

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/auth/me', (request, response) => {
    response.set('Cache-Control', 'no-store')
    const coach = options.production && request.session.workspaceCoach !== true
      ? null
      : request.session.coach ?? null
    response.json({ coach })
  })

  app.post('/api/auth/google', requireSameOrigin, async (request, response) => {
    response.set('Cache-Control', 'no-store')
    const credential: unknown = request.body?.credential
    if (typeof credential !== 'string' || credential.length < 1 || credential.length > 10000) {
      response.status(401).json({ error: 'Invalid Google sign-in.' })
      return
    }

    const result = await authenticateGoogleCredential(
      credential,
      options.googleClientId,
      options.allowedGoogleDomain,
      options.verifyGoogleToken,
      localDevelopment ? options.devAllowedEmail?.trim() || undefined : undefined,
    )
    if (result.status !== 200) {
      response.status(result.status).json({ error: result.error })
      return
    }

    // Rotate the session identifier so a pre-login session cannot be reused.
    await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
    request.session.coach = result.coach
    request.session.workspaceCoach = result.workspaceCoach
    await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    response.json({ coach: result.coach })
  })

  app.post('/api/auth/logout', requireSameOrigin, async (request, response) => {
    await new Promise<void>((resolve, reject) => request.session.destroy((error) => error ? reject(error) : resolve()))
    response.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: options.production,
      sameSite: 'lax',
    })
    response.json({ signedOut: true })
  })

  app.post('/api/workouts/share', requireCoach, requireSameOrigin, (request, response) => {
    const config = parseWorkoutConfig(request.body)
    if (!config) {
      response.status(400).json({ error: 'Invalid workout configuration.' })
      return
    }
    response.json({ path: workoutPath(config) })
  })

  app.use((error: Error, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (response.headersSent) return next(error)
    if ('status' in error && error.status === 400) {
      response.status(400).json({ error: 'Invalid request body.' })
      return
    }
    if ('status' in error && error.status === 413) {
      response.status(413).json({ error: 'Request body is too large.' })
      return
    }
    console.error('Request failed:', error)
    response.status(500).json({ error: 'Server error.' })
  })

  return app
}
