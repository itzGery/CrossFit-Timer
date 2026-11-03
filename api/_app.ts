import type { IncomingMessage, ServerResponse } from 'node:http'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'
import { createApp } from '../backend/src/app.js'
import { getAppOptions } from '../backend/src/config.js'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) throw new Error('REDIS_URL is required for Vercel sessions.')

const redisClient = createClient({
  url: redisUrl,
  socket: { connectTimeout: 5000, reconnectStrategy: false },
})
redisClient.on('error', () => console.error('Session store connection error.'))

// Keep the same eight-hour fixed session lifetime as the local file store.
const sessionStore = new RedisStore({ client: redisClient, prefix: 'yaqbot:', disableTouch: true })
const app = createApp(getAppOptions(sessionStore))
let connectionPromise: Promise<unknown> | undefined

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (!redisClient.isReady) {
      connectionPromise ??= redisClient.connect().catch((error: unknown) => {
        connectionPromise = undefined
        throw error
      })
      await connectionPromise
    }
    app(request, response)
  } catch {
    response.setHeader('Content-Type', 'application/json')
    response.statusCode = 503
    response.end(JSON.stringify({ error: 'Authentication service is temporarily unavailable.' }))
  }
}
