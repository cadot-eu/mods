import Fastify from 'fastify';
import { loadPlugins } from './core/plugin-loader.js';
import HotConfig from './core/hot-config.js';
import { createLoggerMixin } from './core/log.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyCookie from '@fastify/cookie';
import fs from 'fs';
import authPlugin from './core/auth.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  disableRequestLogging: true,
  logger: {
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore:'pid,hostname,file',
            messageFormat:  '[{file}] {msg}',
          }
        },
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname,file',
            messageFormat: ' [{file}] {msg}',
            destination: path.join(__dirname, 'fastify.log')
          }
        }
      ]
    },
    mixin: createLoggerMixin()
  }
});



// Charger et surveiller les configs avec HotConfig
const configs = new HotConfig('./config', { 
  logger: fastify.log,
  restartOnUpdate: true  // Active le redémarrage automatique lors des modifications
});

// Démarrer HotConfig et attendre explicitement la fin du chargement
await configs.start();
await configs.loadAllConfigs(); // S'assurer que TOUTES les configs sont chargées

// Rendre les configs accessibles dans fastify
fastify.decorate('configs', configs);

// Enregistrer le plugin cookie AVANT de charger les plugins
await fastify.register(fastifyCookie);
// Enregistrer le plugin auth APRÈS les configs mais AVANT les autres plugins
await fastify.register(authPlugin);

// Charger les plugins APRÈS le plugin auth
await loadPlugins(fastify);

// Route explicite pour /favicon.ico (fallback si nécessaire)
fastify.get('/favicon.ico', async (request, reply) => {
  const candidates = [
    path.join(__dirname, 'static', 'favicon.ico'),
    path.join(__dirname, '..', 'favicon.ico')
  ];
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p);
      return reply.type('image/x-icon').send(buf);
    } catch {}
  }
  return reply.code(404).send();
});

// Gérer la fermeture propre
fastify.addHook('onClose', async () => {
  configs.stop();
});

// Log uniquement les réponses en erreur (4xx, 5xx) - format condensé
fastify.addHook('onResponse', async (request, reply) => {
  const code = reply.statusCode;
  if (code >= 300) {
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    fastify.log.error(`[${request.method}] ${request.url} - ${code} (${ip})`);
  }
});

await fastify.listen({ port: 3000, host: '0.0.0.0' });

