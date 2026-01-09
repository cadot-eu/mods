import path from 'path'
import fs from 'fs'

/**
 * Détermine le type MIME approprié en fonction de l'extension du fichier
 * @param {string} filename - Nom du fichier
 * @returns {string} Type MIME correspondant
 */
export function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  switch(ext) {
    case '.html': return 'text/html'
    case '.js': return 'application/javascript'
    case '.txt': return 'text/plain'
    case '.css': return 'text/css'
    case '.json': return 'application/json'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.otf': return 'font/otf'
    default: return 'text/plain'
  }
}

/**
 * Crée des routes Fastify pour servir automatiquement tous les fichiers d'un répertoire
 * @param {Object} fastify - Instance Fastify
 * @param {string} basePath - Chemin de base pour les routes
 * @param {string} directory - Répertoire contenant les fichiers à servir
 * @param {Object} options - Options de configuration
 * @param {string[]} [options.excludeExtensions=['.md']] - Extensions à exclure
 * @param {string[]} [options.excludeFiles=[]] - Noms de fichiers spécifiques à exclure
 * @param {boolean} [options.serveIndex=true] - Si vrai, crée une route pour le chemin de base qui sert index.html
 */
export function createStaticFileRoutes(fastify, basePath, directory, options = {}) {
  const {
    excludeExtensions = ['.md'],
    excludeFiles = [],
    serveIndex = true
  } = options

  // Vérifier que le répertoire existe
  if (!fs.existsSync(directory)) {
    throw new Error(`Le répertoire ${directory} n'existe pas`)
  }

  // Lister tous les fichiers du répertoire
  const files = fs.readdirSync(directory)
  
  // Créer une route pour chaque fichier
  files.forEach(filename => {
    // Vérifier si le fichier doit être exclu
    const fileExtension = path.extname(filename).toLowerCase()
    const shouldExcludeByExtension = excludeExtensions.includes(fileExtension)
    const shouldExcludeByFilename = excludeFiles.includes(filename)
    
    if (shouldExcludeByExtension || shouldExcludeByFilename) {
      return
    }
    
    const filePath = path.join(directory, filename)
    const mimeType = getMimeType(filename)
    
    // Créer la route Fastify
    // S'assurer que le chemin commence bien par '/'
    const routePath = basePath.startsWith('/') ? `${basePath}/${filename}` : `/${basePath}/${filename}`
    fastify.get(routePath, async (_, reply) => {
      reply.type(mimeType).send(fs.readFileSync(filePath))
    })
  })

  // Créer une route pour le chemin de base qui sert index.html si demandé
  if (serveIndex) {
    const indexPath = path.join(directory, 'index.html')
    if (fs.existsSync(indexPath)) {
      const routePath = basePath.startsWith('/') ? basePath : `/${basePath}`
      fastify.get(routePath, async (_, reply) => {
        reply.type('text/html').send(fs.readFileSync(indexPath))
      })
    }
  }
}
