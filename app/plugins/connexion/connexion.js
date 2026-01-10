import fp from 'fastify-plugin'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createStaticFileRoutes } from '/app/core/static-file-router.js'

export default fp(async function connexionPlugin(fastify) {
  const pluginDir = path.dirname(new URL(import.meta.url).pathname)
  const basePath = '/connexion'

  // Créer les routes pour servir automatiquement tous les fichiers du répertoire
  createStaticFileRoutes(fastify, basePath, pluginDir, {
    excludeExtensions: ['.md'],
    serveIndex: true
  })

  // Route pour servir admin.html (contournement du routeur statique qui exclut les HTML)
  fastify.get('/connexion/admin.html', async (_, reply) => {
    const adminPath = path.join(pluginDir, 'admin.html')
    reply.type('text/html').send(fs.readFileSync(adminPath))
  })

  // Route principale - affichage direct selon état d'authentification
  fastify.get('/connexion', async (request, reply) => {
    try {
      // Récupérer directement le sessionId depuis le cookie
      const sessionId = request.cookies.auth_session
      
      if (sessionId) {
        // Vérifier si la session est valide
        const checkResponse = await fetch('http://localhost:3000/auth/check', {
          headers: {
            'Cookie': request.headers.cookie || ''
          }
        })
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json()
          
          if (checkData.authenticated) {
            if (checkData.isAdmin) {
              // AU LIEU DE REDIRIGER, AFFICHER DIRECTEMENT LE CONTENU
              const adminPath = path.join(pluginDir, 'admin.html')
              return reply.type('text/html').send(fs.readFileSync(adminPath))
            } else {
              // AFFICHER DIRECTEMENT LA PAGE "CONNECTE"
              return reply.type('text/html').send(`
                <html>
                  <head>
                    <title>Accès limité</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                  </head>
                  <body class="bg-light">
                    <div class="container mt-5">
                      <div class="row justify-content-center">
                        <div class="col-md-6">
                          <div class="card">
                            <div class="card-body text-center">
                              <h2 class="card-title text-success">✅ Connecté</h2>
                              <p class="card-text">Bonjour ${checkData.username},</p>
                              <p class="card-text text-muted">Vous êtes connecté.</p>
                              <div class="mt-3">
                                <a href="/connexion/logout" class="btn btn-danger">Déconnexion</a>
                                <a href="/connexion" class="btn btn-secondary ms-2">Retour</a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
              `)
            }
          }
        }
      }
      
      // Si pas authentifié, AFFICHER DIRECTEMENT LA PAGE DE LOGIN AU LIEU DE REDIRIGER
      const indexPath = path.join(pluginDir, 'index.html')
      return reply.type('text/html').send(fs.readFileSync(indexPath))
      
    } catch (error) {
      fastify.log.error('Erreur lors de la vérification d\'authentification:', error)
      return reply.type('text/html').send(`
        <html>
          <head>
            <title>Erreur d'authentification</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
          </head>
          <body class="bg-light">
            <div class="container mt-5">
              <div class="row justify-content-center">
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-body text-center">
                      <h2 class="card-title text-danger">❌ Erreur</h2>
                      <p class="card-text">Une erreur est survenue lors de la vérification de votre session.</p>
                      <div class="mt-3">
                        <a href="/connexion" class="btn btn-primary">Retour à la page de connexion</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `)
    }
  })

  // Route de logout
  fastify.get('/connexion/logout', async (request, reply) => {
    try {
      // Utiliser directement le service de logout de Fastify
      const sessionId = request.cookies.auth_session
      
      if (sessionId) {
        // Détruire la session via le service d'authentification
        if (fastify.auth.isAuthenticated(request)) {
          // Appeler la route POST /auth/logout pour nettoyer proprement
          await fetch('http://localhost:3000/auth/logout', {
            method: 'POST',
            headers: {
              'Cookie': request.headers.cookie || ''
            }
          })
        }
      }

      // Effacer le cookie de session
      reply.clearCookie('auth_session', { path: '/' })
      
      // Rediriger vers la page de login
      return reply.redirect('/connexion/index.html')
    } catch (error) {
      fastify.log.error('Erreur lors de la déconnexion:', error)
      return reply.redirect('/connexion/index.html')
    }
  })

  fastify.log.info('Plugin CONNEXION - URLs accessibles par navigateur:/connexion ,/connexion/admin.html,/connexion/logout')

}, { name: 'connexion' })
