import { createApp } from './app.js'
import { getAppOptions } from './config.js'

const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}
const app = createApp(getAppOptions())

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
