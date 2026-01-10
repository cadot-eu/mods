function promptApp() {
  return {
    pluginName: '',
    purpose: '',
    routes: '',
    comments: '',
    prompt: '',
    apiText: '',
    
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

    // Nouveaux états pour la création de plugins
    pluginFileName: '',
    mainFileContent: '',
    additionalFiles: [],
    
    // Nouveaux états pour les fichiers de configuration
    configFiles: [],

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

    // Méthodes pour la création de plugins
    addAdditionalFile() {
      this.additionalFiles.push({
        name: '',
        content: ''
      })
    },

    removeAdditionalFile(index) {
      this.additionalFiles.splice(index, 1)
    },

    // Méthodes pour la gestion des fichiers de configuration
    addConfigFile() {
      this.configFiles.push({
        name: '',
        content: ''
      })
    },

    removeConfigFile(index) {
      this.configFiles.splice(index, 1)
    },

    async createPlugin() {
      // Validation de base
      if (!this.pluginName.trim()) {
        alert('Veuillez saisir un nom de plugin')
        return
      }

      if (!this.mainFileContent.trim()) {
        alert('Veuillez saisir le code JavaScript principal')
        return
      }

      // Générer automatiquement le nom du fichier principal
      const pluginName = this.pluginName.trim()
      const pluginFileName = `${pluginName}.js`
      const pluginDir = `/app/plugins/${pluginName}`

      try {
        // Créer le dossier du plugin dans tous les cas
        await this.createDirectory(pluginDir)
        
        // Créer le fichier principal dans le dossier du plugin
        await this.createFile(`${pluginDir}/${pluginFileName}`, this.mainFileContent)
        
        // Créer les fichiers supplémentaires si présents
        let additionalFilesCount = 0
        for (const file of this.additionalFiles) {
          if (file.name && file.content) {
            await this.createFile(`${pluginDir}/${file.name}`, file.content)
            additionalFilesCount++
          }
        }
        
        // Créer les fichiers de configuration dans /app/config/
        let configFilesCount = 0
        for (const config of this.configFiles) {
          if (config.name && config.content) {
            await this.createFile(`/app/config/${config.name}`, config.content)
            configFilesCount++
          }
        }

        // Ajouter le plugin à la liste d'ordre dans order.yaml
        await this.addPluginToOrder(pluginName)

        // Message de succès
        let message = `Plugin ${pluginName}/ créé avec succès !`
        if (additionalFilesCount > 0) {
          message += ` (${additionalFilesCount + 1} fichiers)`
        }
        if (configFilesCount > 0) {
          message += ` et ${configFilesCount} fichier(s) de config`
        }
        alert(message + ' !')

        // Réinitialiser le formulaire
        this.pluginFileName = ''
        this.mainFileContent = ''
        this.additionalFiles = []
        this.configFiles = []

      } catch (error) {
        console.error('Erreur lors de la création du plugin:', error)
        alert('Erreur lors de la création du plugin. Voir la console pour plus de détails.')
      }
    },

    async addPluginToOrder(pluginName) {
      try {
        // Utiliser fastify.configs pour lire la configuration
        const response = await fetch('/api/configs/order.yaml')
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`)
        }
        
        const config = await response.json()
        const order = config.order || []
        
        // Vérifier si le plugin est déjà dans la liste
        if (!order.includes(pluginName)) {
          // Ajouter le plugin à la fin
          order.push(pluginName)
          
          // Mettre à jour la configuration
          const updateResponse = await fetch('/api/configs/order.yaml', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order: order })
          })
          
          if (!updateResponse.ok) {
            throw new Error(`Erreur HTTP ${updateResponse.status}: ${updateResponse.statusText}`)
          }
        }
      } catch (error) {
        console.warn('Erreur lors de l\'ajout du plugin à order.yaml:', error)
        // Ne pas bloquer la création du plugin si l'ajout à order.yaml échoue
      }
    },

    async createFile(path, content) {
      const response = await fetch('/generator/create-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path,
          content: content
        })
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
    },

    async createDirectory(path) {
      const response = await fetch('/generator/create-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path
        })
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
    },

    async generatePrompt() {
      try {
        // Lire le template ia_prompt.txt
        const response = await fetch('/generator/ia_prompt.txt')
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`)
        }
        
        let template = await response.text()
        
        // Remplacer les placeholders
        const plugin = this.pluginName || '[NOM_PLUGIN]'
        const purpose = this.purpose || 'Expliquer le but du plugin'
        
        // Déterminer si des routes ou API ont été configurées
        const hasRoutes = this.routesList.length > 0
        const hasApi = this.apiConfig.methods.length > 0 && this.apiConfig.name
        
        // Générer les sections conditionnelles
        let routesSection = ''
        if (hasRoutes) {
          const routesList = this.routes.split(',').map(r => r.trim()).map(r => `- ${r}`).join('\n')
          routesSection = `Le plugin doit exposer les routes suivantes :\n${routesList}\n`
        } else {
          routesSection = `Le plugin doit exposer les routes nécessaires selon le but du plugin. 
Crée les routes que tu juges appropriées pour répondre au besoin décrit dans le YAML de configuration.\n`
        }
        
        let apiSection = ''
        if (hasApi) {
          const apiList = this.apiText.split(',').map(m => m.trim()).map(m => `- ${m}`).join('\n')
          apiSection = `Le plugin doit exposer les API suivantes via fastify.${this.apiConfig.name} :\n${apiList}\n`
        } else {
          apiSection = `Le plugin doit exposer les API nécessaires selon le but du plugin.
Crée les méthodes que tu juges appropriées pour répondre au besoin décrit dans le YAML de configuration.
Les API doivent être accessibles via fastify.nomDuPlugin.\n`
        }
        
        // Remplacer les placeholders dans le template
        this.prompt = template
          .replace(/{PLUGIN_NAME}/g, plugin)
          .replace(/{PURPOSE}/g, purpose)
          .replace(/{ROUTES_SECTION}/g, routesSection)
          .replace(/{API_SECTION}/g, apiSection)
          .replace(/{STATIC_ROUTES_SECTION}/g, '') // Section vide pour l'instant
          
      } catch (error) {
        console.error('Erreur lors de la génération du prompt:', error)
        alert('Erreur lors de la génération du prompt. Voir la console pour plus de détails.')
      }
    }
  }
}
        
