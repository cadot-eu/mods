import fp from 'fastify-plugin'
import { fileURLToPath } from 'url'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default fp(async function (fastify) {
  const emitter = new EventEmitter()
  const sessions = new Map()
  
  // Charger la configuration avec gestion d'erreur appropriée
  let config;
  try {
    // Essayer d'abord dans le répertoire config/, puis à la racine
      // Si non trouvé dans config/, essayer de charger directement depuis la racine
      const fs = await import('fs/promises');
      const path = await import('path');
      const yaml = await import('js-yaml');
      
      const configPath = path.join(process.cwd(), 'auth.yaml');
      const configContent = await fs.readFile(configPath, 'utf8');
      config = yaml.load(configContent);
    
    if (!config) {
      throw new Error('Fichier de configuration auth.yaml non trouvé');
    }
  } catch (error) {
    fastify.log.error('Erreur lors du chargement de la configuration auth.yaml:', error.message);
    throw new Error('Impossible de charger la configuration d\'authentification');
  }

  if (!config.users || !config.session) {
    fastify.log.error('Config auth.yaml incomplète - clés users ou session manquantes');
    throw new Error('Fichier de configuration auth.yaml incomplet - clés users ou session manquantes');
  }

  fastify.log.info('Config auth.yaml chargée avec succès');

  // Service de gestion des sessions
  const sessionService = {
    create(username) {
      const sessionId = crypto.randomBytes(32).toString('hex')
      const expiresAt = Date.now() + (config.session.maxAge || 24 * 60 * 60 * 1000)
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

  // Service d'authentification
  const authService = (() => {
    return {
   async authenticate(username, password) {
  if (!config || !config.users) {
    fastify.log.error('Config non initialisée dans authService.authenticate')
    return null
  }
  
  fastify.log.info(`Utilisateurs configurés!: ${Object.keys(config.users).join(', ')}`);

  const user = config.users[username]

  if (user && await bcrypt.compare(password, user.password)) {
    return { username, role: user.role }
  } else {
    fastify.log.info(`Authentification échouée pour: ${username}`)
    return null
  }
},

      isAdmin(username) {
        const users = config.users || {}
        const user = users[username]
        return user && user.role === 'admin'
      },

      getUser(username) {
        const users = config.users || {}
        return users[username] || null
      },

      async createUser(username, password, role = 'user') {
        const users = config.users || {}
        
        if (users[username]) {
          throw new Error('Utilisateur déjà existant')
        }
        
        const hashedPassword = await bcrypt.hash(password, 10)
        users[username] = {
          password: hashedPassword,
          role: role
        }
        
        // Mettre à jour la config
        config.users = users
        await saveConfig()
        
        return { username, role }
      },

      async updateUser(username, password, role) {
        const users = config.users || {}
        
        if (!users[username]) {
          throw new Error('Utilisateur non trouvé')
        }
        
        if (password) {
          users[username].password = await bcrypt.hash(password, 10)
        }
        if (role) {
          users[username].role = role
        }
        
        // Mettre à jour la config
        config.users = users
        await saveConfig()
        
        return { username, role: users[username].role }
      },

      deleteUser(username) {
        const users = config.users || {}
        
        if (!users[username]) {
          throw new Error('Utilisateur non trouvé')
        }
        
        delete users[username]
        
        // Mettre à jour la config
        config.users = users
        saveConfig()
        
        return true
      },

      listUsers() {
        const users = config.users || {}
        const userList = []
        
        for (const [username, userData] of Object.entries(users)) {
          userList.push({
            username,
            role: userData.role
          })
        }
        
        return userList
      }
    }
  })()

  // Sauvegarde de la configuration
  async function saveConfig() {
    try {
      const configPath = path.join(process.cwd(), 'auth.yaml')
      const { dump } = await import('js-yaml')
      
      // Convertir la config en format YAML
      const configData = {
        users: config.users,
        session: config.session
      }
      
      const yamlContent = dump(configData)
      await fs.writeFile(configPath, yamlContent)
    } catch (error) {
      fastify.log.error('Erreur lors de la sauvegarde de la configuration:', error)
    }
  }

  // Nettoyage automatique des sessions expirées
  const cleanupInterval = setInterval(() => {
    sessionService.cleanup()
  }, 60 * 60 * 1000)

  // Routes d'authentification

  // Vérification de session
  fastify.get('/auth/check', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (session) {
        return reply.send({ 
          authenticated: true, 
          username: session.username,
          isAdmin: authService.isAdmin(session.username)
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

  // Login
  fastify.post('/auth/login', async (request, reply) => {
    try {
      // Utiliser directement request.body car Fastify le reçoit bien
      const { username, password } = request.body || {};

      if (!username || !password) {
        fastify.log.info(`Données manquantes - username: ${username}, password: ${password}`)
        return reply.status(400).send({ 
          success: false, 
          message: 'Nom d\'utilisateur et mot de passe requis' 
        })
      }

      fastify.log.info(`Tentative de connexion pour: ${username}`)
      
      const authResult = await authService.authenticate(username, password)
      
      if (authResult) {
        const { sessionId, expiresAt } = sessionService.create(username)
        
        reply.setCookie('auth_session', sessionId, {
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: Math.floor((config.session.maxAge || 24 * 60 * 60 * 1000) / 1000),
          sameSite: 'lax'
        })

        return reply.send({ 
          success: true, 
          message: 'Connexion réussie',
          username: authResult.username,
          isAdmin: authResult.role === 'admin'
        })
      } else {
        return reply.status(401).send({ 
          success: false, 
          message: 'Identifiants incorrects' 
        })
      }
    } catch (error) {
      fastify.log.error('Erreur lors du login:', error)
      fastify.log.error('Stack trace:', error.stack)
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur serveur',
        error: error.message,
        stack: error.stack
      })
    }
  })

  // Logout
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      
      if (sessionId) {
        sessionService.destroy(sessionId)
      }

      reply.clearCookie('auth_session', { path: '/' })
      
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

  // Routes CRUD utilisateurs (admin uniquement)

  // Liste des utilisateurs
  fastify.get('/auth/users', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session || !authService.isAdmin(session.username)) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès interdit' 
        })
      }
      
      const users = authService.listUsers()
      return reply.send({ success: true, users })
    } catch (error) {
      fastify.log.error('Erreur lors de la liste des utilisateurs:', error)
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur serveur' 
      })
    }
  })

  // Créer un utilisateur
  fastify.post('/auth/users', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session || !authService.isAdmin(session.username)) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès interdit' 
        })
      }
      
      const { username, password, role } = request.body
      
      if (!username || !password) {
        return reply.status(400).send({ 
          success: false, 
          message: 'Nom d\'utilisateur et mot de passe requis' 
        })
      }
      
      const newUser = await authService.createUser(username, password, role || 'user')
      return reply.send({ 
        success: true, 
        message: 'Utilisateur créé',
        user: newUser
      })
    } catch (error) {
      fastify.log.error('Erreur lors de la création de l\'utilisateur:', error)
      return reply.status(500).send({ 
        success: false, 
        message: error.message || 'Erreur serveur' 
      })
    }
  })

  // Mettre à jour un utilisateur
  fastify.put('/auth/users/:username', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session || !authService.isAdmin(session.username)) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès interdit' 
        })
      }
      
      const { username } = request.params
      const { password, role } = request.body
      
      const updatedUser = await authService.updateUser(username, password, role)
      return reply.send({ 
        success: true, 
        message: 'Utilisateur mis à jour',
        user: updatedUser
      })
    } catch (error) {
      fastify.log.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
      return reply.status(500).send({ 
        success: false, 
        message: error.message || 'Erreur serveur' 
      })
    }
  })

  // Supprimer un utilisateur
  fastify.delete('/auth/users/:username', async (request, reply) => {
    try {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session || !authService.isAdmin(session.username)) {
        return reply.status(403).send({ 
          success: false, 
          message: 'Accès interdit' 
        })
      }
      
      const { username } = request.params
      
      await authService.deleteUser(username)
      return reply.send({ 
        success: true, 
        message: 'Utilisateur supprimé'
      })
    } catch (error) {
      fastify.log.error('Erreur lors de la suppression de l\'utilisateur:', error)
      return reply.status(500).send({ 
        success: false, 
        message: error.message || 'Erreur serveur' 
      })
    }
  })

  // Décoration Fastify pour vérifier l'authentification
  fastify.decorate('auth', {
    isAuthenticated(request) {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      return session !== null
    },

    getUser(request) {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      return session ? session.username : null
    },

    isAdmin(request) {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      return session ? authService.isAdmin(session.username) : false
    },

    requireAuth: async (request, reply) => {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session) {
        return reply.status(401).send({ 
          error: 'Non authentifié',
          message: 'Vous devez être connecté pour accéder à cette ressource' 
        })
      }
      
      request.user = session.username
    },

    requireAdmin: async (request, reply) => {
      const sessionId = request.cookies.auth_session
      const session = sessionService.validate(sessionId)
      
      if (!session || !authService.isAdmin(session.username)) {
        return reply.status(403).send({ 
          error: 'Accès interdit',
          message: 'Vous devez être administrateur pour accéder à cette ressource' 
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
    fastify.log.info('Plugin auth fermé et ressources nettoyées')
  })

}, {
  name: 'auth',
  dependencies: ['@fastify/cookie']
})
