import fp from 'fastify-plugin'
import { fileURLToPath } from 'url'
import { EventEmitter } from 'events'
import path from 'path'
import { createStaticFileRoutes } from '../../core/static-file-router.js'
import fs from 'fs/promises'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default fp(async function (fastify) {
  const pluginDir = path.join(__dirname)
  const basePath = '/protect'
  

  const emitter = new EventEmitter()
  const sessions = new Map()
  
  let config = {}
  try {
    const configPath = path.join(process.cwd(), 'config', 'protect.yaml')
    config = await fastify.configs.get('protect.yaml')
    fastify.log.info('Configuration protect chargée')
  } catch (error) {
    fastify.log.error('Erreur lors du chargement de la configuration protect:', error)
    config = { users: {} }
  }

  // Service de gestion des sessions
  const sessionService = {
    create(username) {
      const sessionId = crypto.randomBytes(32).toString('hex')
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 heures
      sessions.set(sessionId, { username, expiresAt })
      emitter.emit('session:created', { sessionId, username })
      fastify.log.info(`Session créée pour ${username}`)
      return { sessionId, expiresAt }
    },

    validate(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) return null
      if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId)
        return null
      }
      return session
    },

    destroy(sessionId) {
      const session = sessions.get(sessionId)
      if (session) {
        sessions.delete(sessionId)
        emitter.emit('session:destroyed', { sessionId, username: session.username })
        fastify.log.info(`Session détruite pour ${session.username}`)
      }
    },

    cleanup() {
      const now = Date.now()
      for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
          sessions.delete(sessionId)
        }
      }
    }
  }

  // Nettoyage automatique des sessions expirées toutes les heures
  const cleanupInterval = setInterval(() => {
    sessionService.cleanup()
  }, 60 * 60 * 1000)

  // Service d'authentification
  const authService = {
    authenticate(username, password) {
      const users = config.users || {}
      if (users[username] && users[username] === password) {
        return true
      }
      return false
    }
  }

  // Route de la page de login
  fastify.get('/protect', async (request, reply) => {
    const sessionId = request.cookies.protect_session
    const session = sessionService.validate(sessionId)
    
    if (session) {
      return reply.redirect('/protect/dashboard.html')
    }
    
    return reply.redirect('/protect/index.html')
  })

  // Route de login (POST)
  fastify.post('/protect/login', async (request, reply) => {
    try {
      const { username, password } = request.body

      if (!username || !password) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Nom d\'utilisateur et mot de passe requis' 
        })
      }

      if (authService.authenticate(username, password)) {
        const { sessionId, expiresAt } = sessionService.create(username)
        
        reply.setCookie('protect_session', sessionId, {
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: 24 * 60 * 60,
          sameSite: 'lax'
        })

        return reply.send({ 
          success: true, 
          message: 'Connexion réussie',
          username 
        })
      } else {
        return reply.status(401).send({ 
          success: false, 
          message: 'Identifiants incorrects' 
        })
      }
    } catch (error) {
      fastify.log.error('Erreur lors du login:', error)
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur serveur' 
      })
    }
  })

  // Route de logout (POST)
  fastify.post('/protect/logout', async (request, reply) => {
    try {
      const sessionId = request.cookies.protect_session
      
      if (sessionId) {
        sessionService.destroy(sessionId)
      }

      reply.clearCookie('protect_session', { path: '/' })
      
      return reply.send({ 
        success: true, 
        message: 'Déconnexion réussie' 
      })
    } catch (error) {
      fastify.log.error('Erreur lors du logout:', error)
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur serveur' 
      })
    }
  })

  // Route de vérification de session
  fastify.get('/protect/check', async (request, reply) => {
    try {
      const sessionId = request.cookies.protect_session
      const session = sessionService.validate(sessionId)
      
      if (session) {
        return reply.send({ 
          authenticated: true, 
          username: session.username 
        })
      } else {
        return reply.send({ authenticated: false })
      }
    } catch (error) {
      fastify.log.error('Erreur lors de la vérification:', error)
      return reply.status(500).send({ 
        authenticated: false, 
        message: 'Erreur serveur' 
      })
    }
  })

  // Décoration Fastify pour vérifier l'authentification
  fastify.decorate('protect', {
    isAuthenticated(request) {
      const sessionId = request.cookies.protect_session
      const session = sessionService.validate(sessionId)
      return session !== null
    },

    getUser(request) {
      const sessionId = request.cookies.protect_session
      const session = sessionService.validate(sessionId)
      return session ? session.username : null
    },

    requireAuth: async (request, reply) => {
      const sessionId = request.cookies.protect_session
      const session = sessionService.validate(sessionId)
      
      if (!session) {
        return reply.status(401).send({ 
          error: 'Non authentifié',
          message: 'Vous devez être connecté pour accéder à cette ressource' 
        })
      }
      
      request.user = session.username
    }
  })

  // Hook de fermeture pour nettoyer les ressources
  fastify.addHook('onClose', async () => {
    clearInterval(cleanupInterval)
    sessions.clear()
    emitter.removeAllListeners()
    fastify.log.info('Plugin protect fermé et ressources nettoyées')
  })

  // Servir les fichiers statiques manuellement pour éviter les conflits de routes
  // Dashboard
  fastify.get('/protect/dashboard.html', async (_, reply) => {
    const dashboardPath = path.join(pluginDir, 'dashboard.html')
    reply.type('text/html').send(fs.readFileSync(dashboardPath))
  })
  
  // Page de login
  fastify.get('/protect/index.html', async (_, reply) => {
    const indexPath = path.join(pluginDir, 'index.html')
    reply.type('text/html').send(fs.readFileSync(indexPath))
  })
  



  // Affichage des URLs accessibles par navigateur
  fastify.log.info('═══════════════════════════════════════════════════════')
  fastify.log.info('Plugin PROTECT - URLs accessibles par navigateur:')
  fastify.log.info('───────────────────────────────────────────────────────')
  fastify.log.info('  🌐 Page principale:     /protect')
  fastify.log.info('  🔐 Page de connexion:   /protect/index.html')
  fastify.log.info('  📊 Dashboard:           /protect/dashboard.html')
  fastify.log.info('───────────────────────────────────────────────────────')
  fastify.log.info('  Fichiers statiques disponibles:')
  staticFiles.forEach(file => {
    fastify.log.info(`     📄 /protect/${file}`)
  })
  fastify.log.info('═══════════════════════════════════════════════════════')
  fastify.log.info('Plugin PROTECT - Routes Fastify (API):')
  fastify.log.info('───────────────────────────────────────────────────────')
  fastify.log.info('  GET    /protect              → Redirection login/dashboard')
  fastify.log.info('  POST   /protect/login        → Authentification')
  fastify.log.info('  POST   /protect/logout       → Déconnexion')
  fastify.log.info('  GET    /protect/check        → Vérification session')
  fastify.log.info('═══════════════════════════════════════════════════════')
  fastify.log.info('Plugin PROTECT - Décoration Fastify:')
  fastify.log.info('───────────────────────────────────────────────────────')
  fastify.log.info('  fastify.protect.isAuthenticated(request)')
  fastify.log.info('  fastify.protect.getUser(request)')
  fastify.log.info('  fastify.protect.requireAuth (preHandler)')
  fastify.log.info('═══════════════════════════════════════════════════════')

}, {
  name: 'protect',
  dependencies: ['@fastify/cookie']
})