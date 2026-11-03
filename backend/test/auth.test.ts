import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import test from 'node:test'
import type { AddressInfo } from 'node:net'
import type { TokenPayload } from 'google-auth-library'
import session from 'express-session'
import { createApp } from '../src/app.js'

const frontendOrigin = 'http://localhost:5173'
const clientId = 'test-client.apps.googleusercontent.com'

function fakePayload(credential: string): TokenPayload {
  const payload = {
    iss: 'https://accounts.google.com',
    aud: clientId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'google-user-1',
    email: 'hola@yaqbot.com',
    email_verified: true,
    hd: 'yaqbot.com',
  } as TokenPayload

  if (credential === 'expired') payload.exp = Math.floor(Date.now() / 1000) - 1
  if (credential === 'wrong-audience') payload.aud = 'other-client'
  if (credential === 'wrong-issuer') payload.iss = 'https://example.com'
  if (credential === 'unverified') payload.email_verified = false
  if (credential === 'unverified-gmail') payload.email_verified = false
  if (credential === 'missing-hd') delete payload.hd
  if (credential === 'wrong-hd') payload.hd = 'other.com'
  if (credential === 'outside-email') payload.email = 'someone@other.com'
  if (credential === 'gmail' || credential === 'unverified-gmail') {
    payload.email = 'gerardfideu24@gmail.com'
    delete payload.hd
  }
  return payload
}

test('Google sign-in, authorization, and logout', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'yaqbot-auth-'))
  const app = createApp({
    googleClientId: clientId,
    allowedGoogleDomain: 'yaqbot.com',
    sessionSecret: 'test-only-session-secret-at-least-32-characters',
    sessionDirectory: directory,
    frontendOrigin,
    production: false,
    sessionReapIntervalSeconds: -1,
    verifyGoogleToken: async (credential) => {
      if (credential === 'invalid') throw new Error('Invalid signature')
      return fakePayload(credential)
    },
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  async function post(path: string, body: object | null, cookie?: string, origin = frontendOrigin) {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  try {
    assert.equal((await post('/api/workouts/share', { mode: 'amrap', durationSeconds: 60 })).status, 401)
    assert.equal((await post('/api/auth/google', { credential: 'valid' }, undefined, 'https://evil.example')).status, 403)

    for (const credential of ['invalid', 'expired', 'wrong-audience', 'wrong-issuer']) {
      assert.equal((await post('/api/auth/google', { credential })).status, 401, credential)
    }
    for (const credential of ['unverified', 'missing-hd', 'wrong-hd', 'outside-email', 'gmail']) {
      const denied = await post('/api/auth/google', { credential })
      assert.equal(denied.status, 403, credential)
      assert.deepEqual(await denied.json(), { error: 'Only verified @yaqbot.com Workspace accounts can sign in.' })
    }
    const malformed = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: '{',
    })
    assert.equal(malformed.status, 400)
    assert.deepEqual(await malformed.json(), { error: 'Invalid request body.' })

    const login = await post('/api/auth/google', { credential: 'valid' })
    assert.equal(login.status, 200)
    const cookieHeader = login.headers.get('set-cookie') ?? ''
    assert.match(cookieHeader, /HttpOnly/i)
    assert.match(cookieHeader, /SameSite=Lax/i)
    const cookie = cookieHeader.split(';')[0]
    assert.ok(cookie)
    assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), {
      coach: { sub: 'google-user-1', email: 'hola@yaqbot.com' },
    })

    const share = await post('/api/workouts/share', { mode: 'emom', rounds: 2, intervalSeconds: 60 }, cookie)
    assert.equal(share.status, 200)
    assert.deepEqual(await share.json(), { path: '/timer?mode=emom&rounds=2&intervalSeconds=60' })
    assert.equal((await post('/api/workouts/share', { mode: 'amrap', durationSeconds: 60 }, cookie, 'https://evil.example')).status, 403)
    assert.equal((await post('/api/workouts/share', { mode: 'emom', rounds: 0, intervalSeconds: 60 }, cookie)).status, 400)

    const logout = await post('/api/auth/logout', null, cookie)
    assert.equal(logout.status, 200)
    assert.deepEqual(await logout.json(), { signedOut: true })
    assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), { coach: null })
    assert.equal((await post('/api/workouts/share', { mode: 'amrap', durationSeconds: 60 }, cookie)).status, 401)

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise((resolve) => setTimeout(resolve, 150))
    const safeDirectory = resolve(directory)
    if (safeDirectory.startsWith(`${resolve(tmpdir())}${sep}`)) {
      rmSync(safeDirectory, { recursive: true, force: true })
    }
  }
})

test('session expires without a database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'yaqbot-auth-expiry-'))
  const app = createApp({
    googleClientId: clientId,
    allowedGoogleDomain: 'yaqbot.com',
    sessionSecret: 'test-only-session-secret-at-least-32-characters',
    sessionDirectory: directory,
    frontendOrigin,
    production: false,
    sessionMaxAgeMs: 200,
    sessionReapIntervalSeconds: -1,
    verifyGoogleToken: async () => fakePayload('valid'),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  try {
    const login = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'valid' }),
    })
    assert.equal(login.status, 200)
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
    await new Promise((resolve) => setTimeout(resolve, 1200))
    assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), { coach: null })
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise((resolve) => setTimeout(resolve, 150))
    const safeDirectory = resolve(directory)
    if (safeDirectory.startsWith(`${resolve(tmpdir())}${sep}`)) {
      rmSync(safeDirectory, { recursive: true, force: true })
    }
  }
})

test('personal Gmail is allowed only by the verified local development exception', async () => {
  const cases = [
    { name: 'local development', nodeEnv: 'development', production: false, origin: frontendOrigin, expectedStatus: 200 },
    { name: 'production', nodeEnv: 'production', production: true, origin: 'https://timer.example', expectedStatus: 403 },
    { name: 'production flag overrides development', nodeEnv: 'development', production: true, origin: 'https://timer.example', expectedStatus: 403 },
    { name: 'remote development origin', nodeEnv: 'development', production: false, origin: 'https://timer.example', expectedStatus: 403 },
  ] as const

  for (const scenario of cases) {
    const directory = mkdtempSync(join(tmpdir(), 'yaqbot-dev-auth-'))
    const app = createApp({
      googleClientId: clientId,
      allowedGoogleDomain: 'yaqbot.com',
      sessionSecret: 'test-only-session-secret-at-least-32-characters',
      sessionDirectory: directory,
      frontendOrigin: scenario.origin,
      production: scenario.production,
      nodeEnv: scenario.nodeEnv,
      devAllowedEmail: 'gerardfideu24@gmail.com',
      sessionReapIntervalSeconds: -1,
      verifyGoogleToken: async (credential) => {
        if (credential === 'invalid') throw new Error('Invalid signature')
        return fakePayload(credential)
      },
    })
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    try {
      async function signIn(credential: string) {
        return fetch(`${baseUrl}/api/auth/google`, {
          method: 'POST',
          headers: { Origin: scenario.origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        })
      }

      assert.equal((await signIn('invalid')).status, 401, scenario.name)
      assert.equal((await signIn('unverified-gmail')).status, 403, scenario.name)
      const login = await signIn('gmail')
      assert.equal(login.status, scenario.expectedStatus, scenario.name)
      if (scenario.expectedStatus === 200) {
        const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
        assert.ok(cookie)
        assert.deepEqual(await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), {
          coach: { sub: 'google-user-1', email: 'gerardfideu24@gmail.com' },
        })
        const productionApp = createApp({
          googleClientId: clientId,
          allowedGoogleDomain: 'yaqbot.com',
          sessionSecret: 'test-only-session-secret-at-least-32-characters',
          sessionDirectory: directory,
          frontendOrigin: 'https://timer.example',
          production: true,
          nodeEnv: 'production',
          devAllowedEmail: 'gerardfideu24@gmail.com',
          sessionReapIntervalSeconds: -1,
        })
        const productionServer = productionApp.listen(0, '127.0.0.1')
        await new Promise<void>((resolve) => productionServer.once('listening', resolve))
        const productionUrl = `http://127.0.0.1:${(productionServer.address() as AddressInfo).port}`
        try {
          assert.deepEqual(await (await fetch(`${productionUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), { coach: null })
          const share = await fetch(`${productionUrl}/api/workouts/share`, {
            method: 'POST',
            headers: { Cookie: cookie, Origin: 'https://timer.example', 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'amrap', durationSeconds: 60 }),
          })
          assert.equal(share.status, 401)
        } finally {
          await new Promise<void>((resolve) => productionServer.close(() => resolve()))
        }
      } else {
        assert.deepEqual(await login.json(), { error: 'Only verified @yaqbot.com Workspace accounts can sign in.' })
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await new Promise((resolve) => setTimeout(resolve, 150))
      const safeDirectory = resolve(directory)
      if (safeDirectory.startsWith(`${resolve(tmpdir())}${sep}`)) {
        rmSync(safeDirectory, { recursive: true, force: true })
      }
    }
  }
})

test('separate app instances can share and invalidate a server-side session', async () => {
  const sharedStore = new session.MemoryStore()
  const options = {
    googleClientId: clientId,
    allowedGoogleDomain: 'yaqbot.com',
    sessionSecret: 'test-only-session-secret-at-least-32-characters',
    sessionStore: sharedStore,
    frontendOrigin,
    production: false,
    verifyGoogleToken: async () => fakePayload('valid'),
  }
  const firstServer = createApp(options).listen(0, '127.0.0.1')
  const secondServer = createApp(options).listen(0, '127.0.0.1')
  await Promise.all([firstServer, secondServer].map((server) =>
    new Promise<void>((resolve) => server.once('listening', resolve))))
  const firstUrl = `http://127.0.0.1:${(firstServer.address() as AddressInfo).port}`
  const secondUrl = `http://127.0.0.1:${(secondServer.address() as AddressInfo).port}`

  try {
    const login = await fetch(`${firstUrl}/api/auth/google`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'valid' }),
    })
    assert.equal(login.status, 200)
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
    assert.ok(cookie)
    assert.deepEqual(await (await fetch(`${secondUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), {
      coach: { sub: 'google-user-1', email: 'hola@yaqbot.com' },
    })
    assert.equal((await fetch(`${secondUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: frontendOrigin },
    })).status, 200)
    assert.deepEqual(await (await fetch(`${firstUrl}/api/auth/me`, { headers: { Cookie: cookie } })).json(), { coach: null })
  } finally {
    await Promise.all([firstServer, secondServer].map((server) =>
      new Promise<void>((resolve) => server.close(() => resolve()))))
  }
})

test('production login sets a Secure session cookie behind the HTTPS proxy', async () => {
  const productionOrigin = 'https://timer.example'
  const app = createApp({
    googleClientId: clientId,
    allowedGoogleDomain: 'yaqbot.com',
    sessionSecret: 'test-only-session-secret-at-least-32-characters',
    sessionStore: new session.MemoryStore(),
    frontendOrigin: productionOrigin,
    production: true,
    nodeEnv: 'production',
    verifyGoogleToken: async () => fakePayload('valid'),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    const login = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: {
        Origin: productionOrigin,
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential: 'valid' }),
    })
    assert.equal(login.status, 200)
    const cookieHeader = login.headers.get('set-cookie') ?? ''
    assert.match(cookieHeader, /Secure/i)
    assert.match(cookieHeader, /HttpOnly/i)
    assert.match(cookieHeader, /SameSite=Lax/i)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
