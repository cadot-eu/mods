import Fastify from 'fastify';
import { loadPlugins } from './core/plugin-loader.js';
import HotConfig from './core/hot-config.js';
import { createLoggerMixin } from './core/log.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import dotenv from 'dotenv';

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
await configs.start();

// Rendre les configs accessibles dans fastify
fastify.decorate('configs', configs);

// Servir les fichiers statiques depuis app/static à la racine
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'static'),
  prefix: '/',
  // cache désactivé pour simplicité en dev
  decorateReply: false
});

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

// Vérifier et charger automatiquement le plugin IA si les variables d'environnement sont présentes
const envPath = path.join(__dirname, '.env.local');
let env = {};

if (fs.existsSync(envPath)) {
  env = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
}

const apiKey = env.OPENROUTER_API_KEY;
const model = env.OPENROUTER_MODEL;

if (apiKey && model) {
  try {
    const iaPlugin = await import('./core/ia.js');
    await fastify.register(iaPlugin.default);
    fastify.log.info('Plugin IA chargé automatiquement');
  } catch (error) {
    fastify.log.error(`Erreur chargement plugin IA: ${error.message}`);
  }
} else {
  fastify.log.info('Plugin IA désactivé: variables d\'environnement manquantes');
}

// Charge tous les plugins
await loadPlugins(fastify);

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
