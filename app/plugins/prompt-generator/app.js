function promptApp() {
  return {
    pluginName: '',
    purpose: '',
    routes: '',
    comments: '',
    prompt: '',
    
    // Nouveaux états pour la gestion des routes
    routesList: [],
    newRoute: {
      method: 'GET',
      path: '',
      description: '',
      params: ''
    },

    // Nouveaux états pour la gestion des API partagées
    apiConfig: {
      name: '',
      description: '',
      methods: []
    },
    newApiMethod: {
      name: '',
      params: '',
      returnType: '',
      description: ''
    },

    init() {
      // Charger les routes sauvegardées du localStorage si elles existent
      const savedRoutes = localStorage.getItem('promptGeneratorRoutes')
      if (savedRoutes) {
        try {
          this.routesList = JSON.parse(savedRoutes)
          this.updateRoutesText()
        } catch (e) {
          console.warn('Erreur lors du chargement des routes sauvegardées')
        }
      }

      // Charger les API sauvegardées du localStorage si elles existent
      const savedApiConfig = localStorage.getItem('promptGeneratorApiConfig')
      if (savedApiConfig) {
        try {
          this.apiConfig = JSON.parse(savedApiConfig)
          this.updateApiText()
        } catch (e) {
          console.warn('Erreur lors du chargement des API sauvegardées')
        }
      }
    },

    addRoute() {
      // Validation de base
      if (!this.newRoute.path.trim()) {
        alert('Veuillez saisir un endpoint')
        return
      }

      // Vérifier que la route n'existe pas déjà
      const existingRoute = this.routesList.find(r => r.method === this.newRoute.method && r.path === this.newRoute.path)
      if (existingRoute) {
        alert('Cette route existe déjà !')
        return
      }

      // Ajouter la nouvelle route
      this.routesList.push({
        method: this.newRoute.method,
        path: this.newRoute.path.trim(),
        description: this.newRoute.description.trim(),
        params: this.newRoute.params.trim()
      })

      // Réinitialiser le formulaire
      this.newRoute.path = ''
      this.newRoute.description = ''
      this.newRoute.params = ''

      // Mettre à jour le texte des routes et sauvegarder
      this.updateRoutesText()
      this.saveRoutes()
    },

    removeRoute(index) {
      this.routesList.splice(index, 1)
      this.updateRoutesText()
      this.saveRoutes()
    },

    clearRoutes() {
      if (confirm('Êtes-vous sûr de vouloir supprimer toutes les routes ?')) {
        this.routesList = []
        this.routes = ''
        this.saveRoutes()
      }
    },

    updateRoutesText() {
      if (this.routesList.length === 0) {
        this.routes = ''
        return
      }

      // Générer le texte des routes au format attendu
      this.routes = this.routesList.map(route => {
        let routeText = `${route.method} ${route.path}`
        if (route.description) {
          routeText += ` (${route.description})`
        }
        return routeText
      }).join(', ')
    },

    saveRoutes() {
      localStorage.setItem('promptGeneratorRoutes', JSON.stringify(this.routesList))
    },

    // Méthodes pour la gestion des API partagées
    addApiMethod() {
      // Validation de base
      if (!this.newApiMethod.name.trim()) {
        alert('Veuillez saisir un nom de méthode')
        return
      }

      // Vérifier que la méthode n'existe pas déjà
      const existingMethod = this.apiConfig.methods.find(m => m.name === this.newApiMethod.name)
      if (existingMethod) {
        alert('Cette méthode existe déjà !')
        return
      }

      // Ajouter la nouvelle méthode
      this.apiConfig.methods.push({
        name: this.newApiMethod.name.trim(),
        params: this.newApiMethod.params.trim(),
        returnType: this.newApiMethod.returnType.trim(),
        description: this.newApiMethod.description.trim()
      })

      // Réinitialiser le formulaire
      this.newApiMethod.name = ''
      this.newApiMethod.params = ''
      this.newApiMethod.returnType = ''
      this.newApiMethod.description = ''

      // Mettre à jour le texte des API et sauvegarder
      this.updateApiText()
      this.saveApiConfig()
    },

    removeApiMethod(index) {
      this.apiConfig.methods.splice(index, 1)
      this.updateApiText()
      this.saveApiConfig()
    },

    clearApiMethods() {
      if (confirm('Êtes-vous sûr de vouloir supprimer toutes les méthodes ?')) {
        this.apiConfig.methods = []
        this.apiText = ''
        this.saveApiConfig()
      }
    },

    updateApiText() {
      if (this.apiConfig.methods.length === 0 || !this.apiConfig.name) {
        this.apiText = ''
        return
      }

      // Générer le texte des API au format attendu
      const apiName = this.apiConfig.name
      const methodsText = this.apiConfig.methods.map(method => {
        let methodText = `${apiName}.${method.name}`
        if (method.params) {
          methodText += `(${method.params})`
        }
        if (method.returnType) {
          methodText += ` -> ${method.returnType}`
        }
        if (method.description) {
          methodText += ` (${method.description})`
        }
        return methodText
      }).join(', ')

      this.apiText = `fastify.${apiName} = { ${methodsText} }`
    },

    saveApiConfig() {
      localStorage.setItem('promptGeneratorApiConfig', JSON.stringify(this.apiConfig))
    },

    generatePrompt() {
      const plugin = this.pluginName || '[NOM_PLUGIN]'
      const routes = this.routes || ''
      const api = this.apiText || ''
      const purpose = this.purpose || 'Expliquer le but du plugin'
      const comments = this.comments || 'Décrire l’interaction principale de l’interface'

      // Déterminer si des routes ou API ont été configurées
      const hasRoutes = this.routesList.length > 0
      const hasApi = this.apiConfig.methods.length > 0 && this.apiConfig.name

      this.prompt = `
Crée un plugin Fastify nommé ${plugin}.
Le fichier JS principal est dans plugins/${plugin}.js.
Les assets sont dans plugins/${plugin}/ et contiennent les fichiers nécessaires.

Au début du fichier, inclure :
import { EventEmitter } from 'events'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

Le plugin charge la configuration via fastify.configs.get('${plugin}').
Le fichier YAML associé définit ${purpose}.

${hasRoutes ? `Le plugin doit exposer les routes suivantes :
${routes.split(',').map(r => r.trim()).map(r => `- ${r}`).join('\n')}

` : `Le plugin doit exposer les routes nécessaires selon le but du plugin. 
Crée les routes que tu juges appropriées pour répondre au besoin décrit dans le YAML de configuration.

`}${hasApi ? `Le plugin doit exposer les API suivantes via fastify.${this.apiConfig.name} :
${api.split(',').map(m => m.trim()).map(m => `- ${m}`).join('\n')}

` : `Le plugin doit exposer les API nécessaires selon le but du plugin.
Crée les méthodes que tu juges appropriées pour répondre au besoin décrit dans le YAML de configuration.
Les API doivent être accessibles via fastify.nomDuPlugin.

`}La gestion des erreurs doit être propre : 400 pour requêtes mal formées, 500 pour erreurs internes.

L'interface utilisateur :
Utiliser Bootstrap + Bootswatch via CDN, Bootstrap Icons et Alpine.js via CDN
Le layout est basé sur d-flex, responsive et modulable
Éviter tout conflit entre Bootstrap et Alpine.js
L’utilisateur peut ${comments}
La page principale index.html doit être servie via la route /${plugin} et charger tous les assets nécessaires

Le code doit être propre, modulaire et conforme aux bonnes pratiques Fastify
Séparer la logique des routes, services et helpers
Ajouter des logs informatifs lors du chargement et des actions importantes
Gérer les erreurs et exceptions dans toutes les routes
Le plugin doit être compatible avec import/export ES Modules et fastify-plugin

Bonnes pratiques supplémentaires :
Préparer le plugin pour être chargé dynamiquement dans Fastify
Ajouter des commentaires clairs pour faciliter la maintenance
Rendre la structure facile à étendre pour ajouter de nouvelles routes ou pages
      `.trim()
    }
  }
}
