import path from 'path'
import fs from 'fs'
import mime from 'mime-types'

/**
 * Crée des routes Fastify pour servir automatiquement tous les fichiers d'un répertoire
 * @param {Object} fastify - Instance Fastify
 * @param {string} basePath - Chemin de base pour les routes
 * @param {string} directory - Répertoire contenant les fichiers à servir
 * @param {Object} options - Options de configuration
 * @param {string[]} [options.excludeExtensions=['.md']] - Extensions à exclure
 * @param {string[]} [options.excludeFiles=[]] - Noms de fichiers spécifiques à exclure
 * @param {boolean} [options.serveIndex=false] - Si vrai, crée une route /basePath/index.html pour servir index.html
 */
export function createStaticFileRoutes(fastify, basePath, directory, options = {}) {
  const {
    excludeExtensions = ['.md'],
    excludeFiles = [],
    serveIndex = false
  } = options

  // Vérifier que le répertoire existe
  if (!fs.existsSync(directory)) {
    throw new Error(`Le répertoire ${directory} n'existe pas`)
  }

  // Normaliser le basePath pour s'assurer qu'il commence par /
  const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`
  
  // Extraire le nom du plugin depuis le basePath (ex: /connexion -> connexion)
  const pluginName = normalizedBasePath.split('/').filter(Boolean)[0]

  // Lister tous les fichiers du répertoire
  const files = fs.readdirSync(directory)
  
  const createdRoutes = []

  // Créer une route pour chaque fichier
  files.forEach(filename => {
    // Exclure le fichier du plugin lui-même (ex: connexion.js)
    if (filename === `${pluginName}.js`) {
      return
    }
    
    // Vérifier si le fichier doit être exclu
    const fileExtension = path.extname(filename).toLowerCase()
    const shouldExcludeByExtension = excludeExtensions.includes(fileExtension)
    const shouldExcludeByFilename = excludeFiles.includes(filename)

    // Si serveIndex est true et que c'est index.html, on le traite séparément
    if (serveIndex && filename === 'index.html') {
      return
    }

    // Exclure les fichiers HTML pour éviter les conflits avec les routes personnalisées
    if (fileExtension === '.html') {
      return
    }

    if (shouldExcludeByExtension || shouldExcludeByFilename) {
      return
    }

    const filePath = path.join(directory, filename)
    const mimeType = mime.lookup(filename) || 'application/octet-stream'
    const routePath = `${normalizedBasePath}/${filename}`

    // Vérifier si la route existe déjà avant de la créer
    if (fastify.hasRoute({ url: routePath, method: 'GET' })) {
      return
    }

    // Créer la route Fastify
    fastify.get(routePath, async (_, reply) => {
      reply.type(mimeType).send(fs.readFileSync(filePath))
    })
    
    createdRoutes.push(routePath)
  })

  // Créer une route /basePath/index.html pour servir index.html si demandé
  if (serveIndex) {
    const indexPath = path.join(directory, 'index.html')
    const indexRoutePath = `${normalizedBasePath}/index.html`
    
    if (fs.existsSync(indexPath)) {
      // Vérifier si la route existe déjà
      if (!fastify.hasRoute({ url: indexRoutePath, method: 'GET' })) {
        fastify.get(indexRoutePath, async (_, reply) => {
          reply.type('text/html').send(fs.readFileSync(indexPath))
        })
        createdRoutes.push(indexRoutePath)
      }
    }
  }
  
  // Logger toutes les routes créées
  if (createdRoutes.length > 0) {
    fastify.log.info(`Routes créées: ${createdRoutes.join(', ')}`)
  }
}