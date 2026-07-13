import { createApp } from './server.js'

const port = Number(process.env.PORT ?? 8787)
createApp().listen(port, () => {
  console.log(`architecture-map MCP server listening on :${port}`)
})
