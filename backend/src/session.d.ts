import 'express-session'
import type { Coach } from './auth.js'

declare module 'express-session' {
  interface SessionData {
    coach?: Coach
    workspaceCoach?: boolean
  }
}
