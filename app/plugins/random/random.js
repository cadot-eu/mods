// plugins/random.js
import { EventEmitter } from 'events'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import fastifyPlugin from 'fastify-plugin'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FICHIERCONFIG = 'random.yaml'

export default fastifyPlugin(async function (fastify) {
  const emitter = new EventEmitter()

  // Chargement de la configuration YAML
  async function loadConfig() {
    try {
      const fichierconfig = path.join(process.cwd(), 'config', FICHIERCONFIG)
      const content = await fs.readFile(fichierconfig, 'utf8')
      const config = yaml.load(content)
      fastify.log.info('Configuration random.yaml chargée avec succès.')
      return config
    } catch (err) {
      fastify.log.error('Impossible de charger random.yaml : ' + err)
      return { numbers: [1, 2, 3, 4, 5] }
    }
  }

  const config = await loadConfig()

  // Service pour générer un nombre aléatoire
  function getRandomNumber() {
    const nums = config.numbers || [1, 2, 3, 4, 5]
    const index = Math.floor(Math.random() * nums.length)
    return nums[index]
  }

  // Décoration Fastify pour exposer l'API
  fastify.decorate('random', { getNumber: getRandomNumber })

  // Route API pour obtenir un nombre aléatoire
  fastify.get('/randomui', async (request, reply) => {
    try {
      return { number: getRandomNumber() }
    } catch (err) {
      fastify.log.error(err)
      reply.status(500).send({ error: 'Erreur lors de la génération du nombre' })
    }
  })

  // Route pour servir l'UI (HTML et assets séparés)
  fastify.get('/random/ui', async (request, reply) => {
    try {
      const uiPath = path.join(__dirname, 'ui.html')
      const content = await fs.readFile(uiPath, 'utf8')
      reply.type('text/html').send(content)
    } catch (err) {
      fastify.log.error(err)
      reply.status(500).send('Impossible de charger l\'UI')
    }
  })

  // Route pour servir le JS de l'UI
  fastify.get('/random/ui.js', async (request, reply) => {
    try {
      const jsPath = path.join(__dirname, 'ui.js')
      const content = await fs.readFile(jsPath, 'utf8')
      reply.type('application/javascript').send(content)
    } catch (err) {
      fastify.log.error(err)
      reply.status(500).send('// Impossible de charger ui.js')
    }
  })

  // Hook de nettoyage
  fastify.addHook('onClose', async (instance, done) => {
    emitter.removeAllListeners()
    done()
  })
})
