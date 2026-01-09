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

  const apiKey = env.IA_API_KEY
  const model = env.IA_MODEL
  const baseUrl = env.IA_BASE_URL // OpenAI-compatible

  // Clé de chiffrement aléatoire pour les conversations
  const encryptionKey = crypto.randomBytes(32)
  const ivLength = 16

  function encrypt(data) {
    const iv = crypto.randomBytes(ivLength)
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return { encrypted, iv: iv.toString('hex'), authTag }
  }

  function decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(encryptedData.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return JSON.parse(decrypted)
  }

  function saveConversation(conversationId, messages) {
    const conversationData = { id: conversationId, messages, updated_at: Date.now() }
    const encrypted = encrypt(conversationData)
    const filePath = path.join('/tmp', `ia-${conversationId}.enc`)
    fs.writeFileSync(filePath, JSON.stringify(encrypted))
  }

  function loadConversation(conversationId) {
    const filePath = path.join('/tmp', `ia-${conversationId}.enc`)
    if (!fs.existsSync(filePath)) return null
    try {
      const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return decrypt(encryptedData)
    } catch (error) {
      fastify.log.error(`Erreur chargement conversation ${conversationId}: ${error.message}`)
      return null
    }
  }

  // ------------------- APPEL IA -------------------
  async function callIA(messages, options = {}) {
    const payload = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      ...options
    }

    try {
      fastify.log.info(`Appel IA: ${baseUrl} avec modèle ${model}`)
      fastify.log.debug(`Payload: ${JSON.stringify(payload)}`)

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      })

      fastify.log.debug(`Réponse IA: status ${res.status}`)

      if (!res.ok) {
        const text = await res.text()
        fastify.log.error(`Erreur HTTP IA: ${res.status} - ${res.statusText}`)
        fastify.log.error(`Contenu erreur: ${text}`)
        
        try {
          const errJson = JSON.parse(text)
          throw new Error(`Erreur API: ${errJson.error?.message || errJson.error || text}`)
        } catch {
          throw new Error(`Erreur HTTP: ${res.status} ${res.statusText} - ${text}`)
        }
      }

      const data = await res.json()
      fastify.log.debug(`Réponse brute IA: ${JSON.stringify(data)}`)

      // Vérification de la structure de réponse - compatibilité avec différents formats
      let content = null
      
      // Format OpenAI standard
      if (data.choices && Array.isArray(data.choices) && data.choices[0]?.message?.content) {
        content = data.choices[0].message.content
        fastify.log.info('Format OpenAI standard détecté')
      }
      // Format alternatif (OpenRouter parfois différent)
      else if (data.message && data.message.content) {
        content = data.message.content
        fastify.log.info('Format message.content détecté')
      }
      // Format avec texte brut
      else if (data.content) {
        content = data.content
        fastify.log.info('Format content brut détecté')
      }
      // Format avec réponse dans data
      else if (data.response) {
        content = data.response
        fastify.log.info('Format response détecté')
      }
      // Format avec texte dans choices alternatives
      else if (data.choices && Array.isArray(data.choices) && data.choices[0]?.text) {
        content = data.choices[0].text
        fastify.log.info('Format choices.text détecté')
      }

      if (!content) {
        throw new Error(`Structure de réponse inattendue. Données reçues: ${JSON.stringify(data)}`)
      }

      fastify.log.info('Réponse IA reçue avec succès')
      return content
    } catch (err) {
      fastify.log.error(`Erreur IA: ${err.message}`)
      throw err
    }
  }

  // ------------------- ROUTES -------------------
  fastify.decorate('ia', {
    async newConversation(message) {
      if (!message || typeof message !== 'string') throw new Error('Message requis')
      const conversationId = crypto.randomUUID()
      const messages = [{ role: 'user', content: message }]
      const response = await callIA(messages)
      messages.push({ role: 'assistant', content: response })
      saveConversation(conversationId, messages)
      return { success: true, response, conversation_id: conversationId, model }
    },

    async continueConversation(conversationId, message) {
      if (!message || typeof message !== 'string') throw new Error('Message requis')
      const conversation = loadConversation(conversationId)
      if (!conversation) throw new Error('Conversation non trouvée')
      conversation.messages.push({ role: 'user', content: message })
      const response = await callIA(conversation.messages)
      conversation.messages.push({ role: 'assistant', content: response })
      saveConversation(conversationId, conversation.messages)
      return { success: true, response, conversation_id: conversationId, model }
    }
  })

}, { name: 'ia' })
