import fp from 'fastify-plugin'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import dotenv from 'dotenv'

export default fp(async function iaPlugin(fastify) {
  // Charger les variables d'environnement
  const envPath = path.join(process.cwd(), '.env.local')
  let env = {}
  
  if (fs.existsSync(envPath)) {
    env = dotenv.parse(fs.readFileSync(envPath))
  }

  const apiKey = env.OPENROUTER_API_KEY
  const model = env.OPENROUTER_MODEL
  const baseUrl = env.OPENROUTER_BASE_URL || 'https://api.openai.com/v1/chat/completions'

  // Vérifier que les variables requises sont définies
  if (!apiKey || !model) {
    fastify.log.warn('Plugin IA désactivé: OPENROUTER_API_KEY ou OPENROUTER_MODEL non définis dans .env.local')
    return
  }

  // Générer une clé de chiffrement aléatoire pour les conversations
  const encryptionKey = crypto.randomBytes(32)
  const ivLength = 16

  /**
   * Chiffre les données avec AES-256-GCM
   */
  function encrypt(data) {
    const iv = crypto.randomBytes(ivLength)
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag
    }
  }

  /**
   * Déchiffre les données avec AES-256-GCM
   */
  function decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(encryptedData.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return JSON.parse(decrypted)
  }

  /**
   * Sauvegarde une conversation dans un fichier chiffré
   */
  function saveConversation(conversationId, messages) {
    const conversationData = {
      id: conversationId,
      messages,
      updated_at: Date.now()
    }
    
    const encrypted = encrypt(conversationData)
    const filePath = path.join('/tmp', `ia-${conversationId}.enc`)
    
    fs.writeFileSync(filePath, JSON.stringify(encrypted))
  }

  /**
   * Charge une conversation depuis un fichier chiffré
   */
  function loadConversation(conversationId) {
    const filePath = path.join('/tmp', `ia-${conversationId}.enc`)
    
    if (!fs.existsSync(filePath)) {
      return null
    }
    
    try {
      const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return decrypt(encryptedData)
    } catch (error) {
      fastify.log.error(`Erreur lors du chargement de la conversation ${conversationId}: ${error.message}`)
      return null
    }
  }

  /**
   * Appelle l'API OpenRouter
   */
  async function callOpenRouter(messages) {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Réponse API invalide')
      }

      return data.choices[0].message.content
    } catch (error) {
      fastify.log.error(`Erreur appel OpenRouter: ${error.message}`)
      throw error
    }
  }

  // ==================== ROUTES ====================

  /**
   * Nouvelle conversation
   */
  fastify.post('/api/ia', async (request, reply) => {
    try {
      const { message } = request.body
      
      if (!message || typeof message !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Message requis'
        })
      }

      // Générer un ID de conversation
      const conversationId = crypto.randomUUID()
      
      // Créer les messages initiaux
      const messages = [
        {
          role: 'user',
          content: message
        }
      ]

      // Appeler l'IA
      const response = await callOpenRouter(messages)

      // Ajouter la réponse aux messages
      messages.push({
        role: 'assistant',
        content: response
      })

      // Sauvegarder la conversation
      saveConversation(conversationId, messages)

      reply.send({
        success: true,
        response,
        conversation_id: conversationId,
        model
      })
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message
      })
    }
  })

  /**
   * Continuer une conversation existante
   */
  fastify.post('/api/ia/:id', async (request, reply) => {
    try {
      const { id: conversationId } = request.params
      const { message } = request.body
      
      if (!message || typeof message !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Message requis'
        })
      }

      // Charger la conversation existante
      const conversation = loadConversation(conversationId)
      
      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation non trouvée'
        })
      }

      // Ajouter le nouveau message
      conversation.messages.push({
        role: 'user',
        content: message
      })

      // Appeler l'IA avec tout le contexte
      const response = await callOpenRouter(conversation.messages)

      // Ajouter la réponse aux messages
      conversation.messages.push({
        role: 'assistant',
        content: response
      })

      // Sauvegarder la conversation mise à jour
      saveConversation(conversationId, conversation.messages)

      reply.send({
        success: true,
        response,
        conversation_id: conversationId,
        model
      })
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error.message
      })
    }
  })

  /**
   * Exposer l'API du plugin via fastify.ia
   */
  fastify.decorate('ia', {
    /**
     * Démarre une nouvelle conversation
     */
    async newConversation(message) {
      if (!message || typeof message !== 'string') {
        throw new Error('Message requis')
      }

      const conversationId = crypto.randomUUID()
      const messages = [{ role: 'user', content: message }]
      const response = await callOpenRouter(messages)
      
      messages.push({ role: 'assistant', content: response })
      saveConversation(conversationId, messages)
      
      return {
        success: true,
        response,
        conversation_id: conversationId,
        model
      }
    },

    /**
     * Continue une conversation existante
     */
    async continueConversation(conversationId, message) {
      if (!message || typeof message !== 'string') {
        throw new Error('Message requis')
      }

      const conversation = loadConversation(conversationId)
      if (!conversation) {
        throw new Error('Conversation non trouvée')
      }

      conversation.messages.push({ role: 'user', content: message })
      const response = await callOpenRouter(conversation.messages)
      
      conversation.messages.push({ role: 'assistant', content: response })
      saveConversation(conversationId, conversation.messages)
      
      return {
        success: true,
        response,
        conversation_id: conversationId,
        model
      }
    }
  })

}, { name: 'ia' })