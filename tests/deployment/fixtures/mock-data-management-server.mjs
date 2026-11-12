import http from 'node:http'

const port = Number(process.argv[2])
const resources = new Set([
  'satelliteDataPool',
  'satelliteMetadata',
  'satelliteDataCatalog',
  'satelliteDataQuery',
  'satelliteDataShare'
])

http.createServer((request, response) => {
  const match = request.url?.match(/^\/api\/data-management\/ai2\/([^/?]+)\/list/)
  if (!match || !resources.has(match[1])) {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ success: false }))
    return
  }

  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({
    success: true,
    result: { records: [{ id: 'seed-row' }], total: 1, current: 1, size: 1 }
  }))
}).listen(port, '127.0.0.1')
