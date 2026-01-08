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

  // Routes pour la création de fichiers et dossiers
  fastify.post('/api/prompt-generator/create-file', async (request, reply) => {
    try {
      const { path: filePath, content } = request.body
      
      // Validation de base
      if (!filePath || !content) {
        return reply.status(400).send({ error: 'Chemin et contenu requis' })
      }

      // Vérifier que le chemin est dans le bon répertoire
      if (!filePath.startsWith('/app/plugins/')) {
        return reply.status(400).send({ error: 'Chemin invalide' })
      }

      // Créer le répertoire parent si nécessaire
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      // Écrire le fichier
      await fs.writeFile(filePath, content)
      
      fastify.log.info(`Fichier créé: ${filePath}`)
      reply.send({ success: true, path: filePath })
    } catch (error) {
      fastify.log.error(`Erreur création fichier: ${error.message}`)
      reply.status(500).send({ error: error.message })
    }
  })

  fastify.post('/api/prompt-generator/create-directory', async (request, reply) => {
    try {
      const { path: dirPath } = request.body
      
      // Validation de base
      if (!dirPath) {
        return reply.status(400).send({ error: 'Chemin requis' })
      }

      // Vérifier que le chemin est dans le bon répertoire
      if (!dirPath.startsWith('/app/plugins/')) {
        return reply.status(400).send({ error: 'Chemin invalide' })
      }

      // Créer le répertoire
      await fs.mkdir(dirPath, { recursive: true })
      
      fastify.log.info(`Répertoire créé: ${dirPath}`)
      reply.send({ success: true, path: dirPath })
    } catch (error) {
      fastify.log.error(`Erreur création répertoire: ${error.message}`)
      reply.status(500).send({ error: error.message })
    }
  })

}, { name: 'prompt-generator' })
