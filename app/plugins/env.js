import fp from 'fastify-plugin'
import dotenv from 'dotenv'
import path from 'path'

export default fp(async function (fastify) {
  // Charger automatiquement toutes les variables de .env.local
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true 
})

  // Partager toutes les variables dans fastify.env
  fastify.decorate('env', { ...process.env })

  fastify.log.info('Variables d’environnement chargées')
}, { name: 'env', priority: 0 })
