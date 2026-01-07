import fp from 'fastify-plugin'

export default fp(async function (fastify) {
  // Surveillance MQTT : température et humidité
  fastify.mqtt.events.on('message', (msg) => {
    try {
      const payload = msg.payload || {}
      const topic = msg.topic || ''

      // Extraire le nom de l'appareil du topic zigbee2mqtt/<nom>
      let deviceName = topic
      const parts = topic.split('/')
      const zigbeeIndex = parts.indexOf('zigbee2mqtt')
      if (zigbeeIndex !== -1 && parts.length > zigbeeIndex + 1) {
        deviceName = parts[zigbeeIndex + 1]
      }

      // Enregistrer température si présente
      if (payload.temperature !== undefined) {
        saveSensorData('temperature', deviceName, payload.temperature)
      }

      // Enregistrer humidité si présente
      if (payload.humidity !== undefined) {
        saveSensorData('humidity', deviceName, payload.humidity)
      }

      // Enregistrer batterie si présente
      if (payload.battery !== undefined) {
        saveSensorData('battery', deviceName, payload.battery)
      }

    } catch (error) {
      fastify.log.error('Erreur traitement MQTT:', error.message)
    }
  })

  // Surveillance Tuya : puissance
  if (fastify.tuyaEvent?.events) {
    fastify.tuyaEvent.events.on('powerChange', (event) => {
      try {
        saveSensorData('consommation', event.deviceId, event.power)
      } catch (error) {
        fastify.log.error('Erreur enregistrement puissance Tuya:', error.message)
      }
    })
  }

  // Enregistrement dans SQLite
  async function saveSensorData(table_name, device_id, value) {
    try {
      if (!fastify.sqlite) {
        fastify.log.warn('SQLite non disponible')
        return
      }

      // Appeler writePoint avec un objet contenant uniquement les colonnes définies dans le YAML
      await fastify.sqlite.writePoint(table_name, {
        device_id: device_id,
        value: value
      })

      fastify.log.info(`Données enregistrées: ${table_name}/${device_id} = ${value}`)

    } catch (error) {
      fastify.log.error('Erreur écriture SQLite:', error.message)
    }
  }

  // Routes API pour accéder aux données historiques
  fastify.get('/api/data/:table', async (request, reply) => {
    const { table } = request.params
    const { device_id, device_nom, limit = 100, offset = 0, order = 'desc', start, end } = request.query

    // Vérifier que la table est valide
    const validTables = fastify.sqlite.getTables()
    if (!validTables.includes(table)) {
      return reply.status(400).send({ error: 'Table invalide' })
    }

    try {
      if (!fastify.sqlite) {
        return reply.status(503).send({ error: 'SQLite non disponible' })
      }

      // Fonction pour convertir device_nom en device_id
      function getDeviceIdFromName(deviceName) {
        const devices = fastify.configs.get('devices') || []
        const device = devices.find(d => d.name === deviceName)
        return device ? device.id : null
      }

      // Déterminer le device_id à utiliser
      let finalDeviceId = device_id
      
      if (device_nom && !device_id) {
        finalDeviceId = getDeviceIdFromName(device_nom)
        if (!finalDeviceId) {
          return reply.status(400).send({ error: `Device nom "${device_nom}" non trouvé dans la configuration` })
        }
      }

      // Construire les filtres
      const filters = {}
      if (finalDeviceId) filters.device_id = finalDeviceId
      if (start) filters.timestamp = { operator: '>=', value: parseInt(start) }
      if (end) filters.timestamp = { operator: '<=', value: parseInt(end) }

      // Récupérer les données avec la méthode style Symfony
      const data = fastify.sqlite.findAll(table, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        order,
        filters
      })

      // Compter le total pour la pagination
      const total = fastify.sqlite.query(
        `SELECT COUNT(*) as total FROM ${table} ${Object.keys(filters).length > 0 ? 'WHERE ' + Object.keys(filters).map(k => `${k} = @${k}`).join(' AND ') : ''}`,
        filters
      )[0]?.total || 0

      return {
        data,
        total,
        filters: {
          table,
          device_id: finalDeviceId,
          device_nom: device_nom || undefined,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order,
          start: start ? parseInt(start) : undefined,
          end: end ? parseInt(end) : undefined
        }
      }

    } catch (error) {
      fastify.log.error('Erreur requête SQLite:', error.message)
      return reply.status(500).send({ error: 'Erreur serveur' })
    }
  })

  // Route pour récupérer toutes les données avec pagination
  fastify.get('/api/data/all', async (request, reply) => {
    const { device_id, limit = 100, offset = 0, order = 'desc', start, end } = request.query

    try {
      if (!fastify.sqlite) {
        return reply.status(503).send({ error: 'SQLite non disponible' })
      }

      // Construire les filtres
      const filters = {}
      if (device_id) filters.device_id = device_id
      if (start) filters.timestamp = { operator: '>=', value: parseInt(start) }
      if (end) filters.timestamp = { operator: '<=', value: parseInt(end) }

      // Récupérer les données de chaque table
      const allData = []

      for (const table of fastify.sqlite.getTables()) {
        const data = fastify.sqlite.findAll(table, {
          limit: parseInt(limit),
          offset: parseInt(offset),
          order,
          filters
        })
        data.forEach(row => {
          allData.push({
            table_name: table,
            device_id: row.device_id,
            value: row.value,
            timestamp: row.timestamp
          })
        })
      }

      // Trier et paginer les résultats combinés
      allData.sort((a, b) => order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp)
      const total = allData.length
      const paginatedData = allData.slice(parseInt(offset), parseInt(offset) + parseInt(limit))

      return {
        data: paginatedData,
        total,
        filters: {
          device_id,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order,
          start: start ? parseInt(start) : undefined,
          end: end ? parseInt(end) : undefined
        }
      }

    } catch (error) {
      fastify.log.error('Erreur requête SQLite:', error.message)
      return reply.status(500).send({ error: 'Erreur serveur' })
    }
  })

  // Route pour lister les appareils uniques
  fastify.get('/api/data/devices', async (request, reply) => {
      // Récupérer les appareils uniques de chaque table
      const allDevices = new Set()

      for (const table of fastify.sqlite.getTables()) {
        const data = fastify.sqlite.findAll(table, { limit: 1000 })
        data.forEach(row => allDevices.add(row.device_id))
      }

      return {
        devices: Array.from(allDevices).sort()
      }

  })

}, { name: 'db' })
