import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

const pluginsDir = path.join(process.cwd(), 'plugins')
const orderFile = path.join(process.cwd(), 'config', 'order.yaml')

// Fonction pour charger l'ordre
function getPluginOrder() {
  if (fs.existsSync(orderFile)) {
    const config = yaml.load(fs.readFileSync(orderFile, 'utf8'))
    return config.order || []
  }
  return []
}

// Fonction pour sauvegarder l'ordre
export function updatePluginOrder(newOrder) {
  const config = { order: newOrder }
  fs.writeFileSync(orderFile, yaml.dump(config))
}

// Fonction principale de chargement
export async function loadPlugins(fastify) {
  
  // Décore fastify pour permettre aux plugins de modifier l'ordre
  fastify.decorate('updatePluginOrder', (newOrder) => {
    updatePluginOrder(newOrder)
    fastify.log.info('Plugin order updated')
  })

  if (!fs.existsSync(pluginsDir)) {
    fastify.log.warn(`Le dossier plugins n'existe pas : ${pluginsDir}`)
    return
  }

  const order = getPluginOrder()
  const files = fs.readdirSync(pluginsDir)
    .filter(f => f.endsWith('.js'))
  
  // Ne charge que les plugins qui ont un ordre défini dans order.json
  const filesWithOrder = files.filter(f => {
    const pluginName = path.basename(f, '.js')
    return order.includes(pluginName)
  })
  
  // Trie selon order.json
  const sortedFiles = filesWithOrder.sort((a, b) => {
    const nameA = path.basename(a, '.js')
    const nameB = path.basename(b, '.js')
    const indexA = order.indexOf(nameA)
    const indexB = order.indexOf(nameB)
    
    return indexA - indexB
  })

  // Charge dans l'ordre
  for (const file of sortedFiles) {
    const pluginName = path.basename(file, '.js')
    const pluginPath = path.join(pluginsDir, file)
    try {
      const plugin = await import(`file://${pluginPath}`)
      await fastify.register(plugin.default)
      fastify.log.info(`✓ Plugin ${pluginName} chargé`)
    } catch (err) {
      fastify.log.error(`✗ Erreur chargement ${pluginName}: ${err.message}`)
    }
  }
  
  fastify.log.info(`${sortedFiles.length} plugins chargés`)
}
