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

// Fonction pour obtenir tous les fichiers JS récursivement
function getAllJSFiles(dir) {
  const files = []
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir)
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        // Si c'est un répertoire, on explore récursivement
        walk(fullPath)
      } else if (stat.isFile() && item.endsWith('.js')) {
        // Si c'est un fichier JS, on l'ajoute avec son chemin relatif
        const relativePath = path.relative(pluginsDir, fullPath)
        files.push(relativePath)
      }
    }
  }
  
  walk(dir)
  return files
}

// Fonction pour extraire le nom du plugin à partir du chemin relatif
function getPluginNameFromPath(relativePath) {
  // Extrait le nom du fichier sans l'extension
  return path.basename(relativePath, '.js')
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
  const files = getAllJSFiles(pluginsDir)
  
  // Vérifier les plugins dans order.yaml qui ne sont pas trouvés
  const foundPlugins = new Set()
  const filesWithOrder = files.filter(f => {
    const pluginName = getPluginNameFromPath(f)
    foundPlugins.add(pluginName)
    return order.includes(pluginName)
  })
  
  // Afficher un warning pour les plugins dans order.yaml mais non trouvés
  for (const pluginName of order) {
    if (!foundPlugins.has(pluginName)) {
      fastify.log.warn(`Plugin "${pluginName}" est dans order.yaml mais le fichier ${pluginName}.js n'a pas été trouvé`)
    }
  }
  
  // Trie selon order.yaml
  const sortedFiles = filesWithOrder.sort((a, b) => {
    const nameA = getPluginNameFromPath(a)
    const nameB = getPluginNameFromPath(b)
    const indexA = order.indexOf(nameA)
    const indexB = order.indexOf(nameB)
    
    return indexA - indexB
  })

  // Charge dans l'ordre
  for (const file of sortedFiles) {
    const pluginName = getPluginNameFromPath(file)
    const pluginPath = path.join(pluginsDir, file)
    try {
      const plugin = await import(`file://${pluginPath}`)
      await fastify.register(plugin.default)
      fastify.log.info(`✓ Plugin ${pluginName} chargé depuis ${file}`)
    } catch (err) {
      fastify.log.error(`✗ Erreur chargement ${pluginName}: ${err.message}`)
    }
  }
  
  fastify.log.info(`${sortedFiles.length} plugins chargés`)
}
