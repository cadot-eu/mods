import fp from 'fastify-plugin'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default fp(async function (fastify) {

  const pluginDir = path.join(__dirname, 'prompt-generator')

  // Route HTML
  fastify.get('/api/prompt-generator', async (_, reply) => {
    reply.type('text/html').send(fs.readFileSync(path.join(pluginDir, 'index.html')))
  })

  // Route JS
  fastify.get('/api/prompt-generator/app.js', async (_, reply) => {
    reply.type('application/javascript').send(fs.readFileSync(path.join(pluginDir, 'app.js')))
  })

  fastify.log.info('Plugin prompt-generator chargé')
}, { name: 'prompt-generator' })
