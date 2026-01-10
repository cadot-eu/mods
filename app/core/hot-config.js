import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import yaml from 'js-yaml';
import { spawn, fork } from 'child_process';

class HotConfig {
  constructor(configDir, options = {}) {
    this.configDir = path.resolve(configDir);
    this.pluginsDir = path.resolve(options.pluginsDir || './plugins');
    this.configs = new Map();
    this.watchers = [];
    this.callbacks = [];
    this.logger = options.logger;
    this.autoStart = options.autoStart !== false;
    this.restartOnUpdate = options.restartOnUpdate || false;
  }

  async loadConfigFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.js':
        case '.mjs': {
          // ES6 modules avec cache busting
          const cacheBuster = `?update=${Date.now()}`;
          const configUrl = pathToFileURL(filePath).href + cacheBuster;
          const module = await import(configUrl);
          return module.default || module;
        }
        
        case '.json': {
          // JSON
          const content = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(content);
        }
        
        case '.yaml':
        case '.yml': {
          // YAML
          const content = fs.readFileSync(filePath, 'utf8');
          return yaml.load(content);
        }
        
        default:
          throw new Error(`Unsupported config file type: ${ext}`);
      }
    } catch (err) {
      throw new Error(`Failed to load ${filePath}: ${err.message}`);
    }
  }

  // Vérifie si un fichier est un fichier de surcharge
  isOverrideFile(filename) {
    const baseName = path.basename(filename);
    return baseName.includes('-surcharge.');
  }

  // Obtient le nom de base d'un fichier de surcharge
  getBaseConfigName(filename) {
    const baseName = path.basename(filename);
    const match = baseName.match(/^(.+?)-surcharge\.(.+)$/);
    return match ? match[1] + '.' + match[2] : null;
  }

  // Applique les surcharges à une configuration
  applyOverrides(config, overrides) {
    if (!Array.isArray(overrides)) {
      return config;
    }

    // Si la config d'origine n'est pas un tableau, on ne peut pas appliquer les surcharges
    if (!Array.isArray(config)) {
      return config;
    }

    let result = [...config];

    for (const override of overrides) {
      if (override.replace && override.with) {
        // Trouver l'index de l'élément à remplacer
        const index = result.findIndex(item => this.deepEqual(item, override.replace));
        if (index !== -1) {
          result[index] = { ...result[index], ...override.with };
        }
      }
    }

    return result;
  }

  // Comparaison dynamique pour trouver l'élément à remplacer
  // Compare uniquement les champs présents dans l'objet replace
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object') return obj1 === obj2;

    // Si obj2 est l'objet "replace" (celui avec moins de champs)
    // on compare uniquement les champs présents dans obj2
    const keysToCompare = Object.keys(obj2);
    
    for (const key of keysToCompare) {
      if (!(key in obj1)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  async loadAllConfigs() {
    if (!fs.existsSync(this.configDir)) {
      console.warn(`Config directory does not exist: ${this.configDir}`);
      return {};
    }

    const files = fs.readdirSync(this.configDir)
      .filter(f => /\.(js|mjs|json|ya?ml)$/i.test(f));
    
    // D'abord charger les configs de base
    const baseConfigs = new Map();
    const overrideConfigs = new Map();

    for (const file of files) {
      const filePath = path.join(this.configDir, file);
      const configName = path.basename(file);
      
      try {
        const config = await this.loadConfigFile(filePath);
        
        if (this.isOverrideFile(file)) {
          if (this.logger) {
            this.logger.info(`Loading override config file: ${file}`);
          } else {
            console.log(`Loading override config file: ${file}`);
          }
          const baseName = this.getBaseConfigName(file);
          if (baseName) {
            if (!overrideConfigs.has(baseName)) {
              overrideConfigs.set(baseName, []);
            }
            overrideConfigs.get(baseName).push(config);
          }
        } else {
          baseConfigs.set(configName, config);
        }
      } catch (err) {
        console.error(`✗ Failed to load config ${file}:`, err.message);
      }
    }
    
    // Appliquer les surcharges aux configs de base
    for (const [configName, config] of baseConfigs) {
      if (overrideConfigs.has(configName)) {
        const overrides = overrideConfigs.get(configName);
        // Fusionner toutes les surcharges
        let finalConfig = config;
        for (const override of overrides) {
          finalConfig = this.applyOverrides(finalConfig, override);
        }
        this.configs.set(configName, finalConfig);
      } else {
        this.configs.set(configName, config);
      }
    }
    
    return Object.fromEntries(this.configs);
  }

  async init() {
    await this.loadAllConfigs();
    return Object.fromEntries(this.configs);
  }

  watch(callback) {
    this.callbacks.push(callback);
    
    const watcher = fs.watch(this.configDir, { recursive: true }, async (eventType, filename) => {
      if (filename && /\.(js|mjs|json|ya?ml)$/i.test(filename)) {
        if (eventType === 'change' || eventType === 'rename') {
          const filePath = path.join(this.configDir, filename);
          const configName = path.basename(filename);
          
          // Vérifier si le fichier existe (rename peut être une suppression)
          if (!fs.existsSync(filePath)) {
            this.configs.delete(configName);
            const allConfigs = Object.fromEntries(this.configs);
            this.callbacks.forEach(cb => cb(null, allConfigs, configName, 'deleted'));
            return;
          }
          
          try {
            const config = await this.loadConfigFile(filePath);
            this.configs.set(configName, config);
            
            const allConfigs = Object.fromEntries(this.configs);
            this.callbacks.forEach(cb => cb(null, allConfigs, configName, 'updated'));
          } catch (err) {
            this.callbacks.forEach(cb => cb(err, null, configName, 'error'));
          }
        }
      }
    });
    
    this.watchers.push(watcher);
    return watcher;
  }

  get(configName, key) {
    const config = this.configs.get(configName);
    if (!config) return undefined;
    
    if (!key) return config;
    
    // Support pour les clés imbriquées: get('mqtt', 'broker.host')
    return key.split('.').reduce((obj, k) => obj?.[k], config);
  }

  getAll() {
    return Object.fromEntries(this.configs);
  }

  has(configName) {
    return this.configs.has(configName);
  }

  list() {
    return Array.from(this.configs.keys());
  }

  async start() {
    // Charger les configs initiales
    await this.loadAllConfigs();
    
    // Démarrer la surveillance avec logging automatique
    this.watch((err, allConfigs, changedConfig, action) => {
      if (err) {
        if (this.logger) {
          this.logger.error(err, `Failed to reload config: ${changedConfig}`);
        } else {
          console.error(err, `Failed to reload config: ${changedConfig}`);
        }
      } else {
        if (this.logger) {
          this.logger.info(`Config "${changedConfig}" ${action}`);
        } else {
          console.log(`Config "${changedConfig}" ${action}`);
        }
        
          // Redémarrer l'application si l'option est activée et que la config est mise à jour
        if (this.restartOnUpdate && action === 'updated') {
          if (this.logger) {
            this.logger.info(`Restarting application due to config change...`);
          } else {
            console.log(`Restarting application due to config change...`);
          }
          
          // Redémarrer l'application en quittant avec le code 42
          // Docker redémarrera automatiquement le conteneur
          process.exit(42);
        }
      }
    });
    
    // Surveiller aussi le répertoire plugins
    if (fs.existsSync(this.pluginsDir)) {
      const pluginsWatcher = fs.watch(this.pluginsDir, { recursive: true }, async (eventType, filename) => {
        if (filename && /\.(js|mjs|json|ya?ml|html|css)$/i.test(filename)) {
          if (eventType === 'change' || eventType === 'rename') {
            if (this.logger) {
              this.logger.info(`Plugin file "${filename}" ${eventType}`);
            } else {
              console.log(`Plugin file "${filename}" ${eventType}`);
            }
            
            // Redémarrer l'application en cas de changement dans les plugins
            if (this.logger) {
              this.logger.info(`Restarting application due to plugin change...`);
            } else {
              console.log(`Restarting application due to plugin change...`);
            }
            
            process.exit(42);
          }
        }
      });
      
      this.watchers.push(pluginsWatcher);
    }
    
    // Log les configs chargées
    if (this.logger) {
      this.logger.info('Configs loaded: ' + this.list().join(', '));
    } else {
      console.log('Configs loaded: ' + this.list().join(', '));
    }
  }

  stop() {
    this.watchers.forEach(w => w.close());
    this.watchers = [];
    this.callbacks = [];
  }
}

export default HotConfig;
