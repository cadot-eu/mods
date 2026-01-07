import fp from 'fastify-plugin'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

export default fp(async function sqlitePlugin(fastify) {
  const cfg = fastify.configs.get('sqlite')
  if (!cfg?.tables) {
    throw new Error('sqlite.yaml invalide ou manquant')
  }

const dbPath = cfg.path || './metrics.db'

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  /* =========================
     Création des tables
     ========================= */
  for (const [table, def] of Object.entries(cfg.tables)) {
    const columns = Object.entries(def.columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(', ')

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columns},
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    fastify.log.info(`[SQLite] Table prête: ${table}`)
  }

  /* =========================
     Écriture générique
     ========================= */
  function writePoint(table, data) {
    const tableCfg = cfg.tables[table]
    if (!tableCfg) {
      throw new Error(`Table inconnue: ${table}`)
    }

    // Valider que les colonnes fournies correspondent aux colonnes définies dans le YAML
    const definedColumns = Object.keys(tableCfg.columns)
    const providedColumns = Object.keys(data)
    
    // Vérifier que toutes les colonnes fournies sont définies dans le YAML
    for (const col of providedColumns) {
      if (!definedColumns.includes(col)) {
        throw new Error(`Colonne inconnue pour la table ${table}: ${col}`)
      }
    }
    
    // Vérifier que toutes les colonnes définies sont fournies (sauf timestamp qui est automatique)
    for (const col of definedColumns) {
      if (!providedColumns.includes(col)) {
        throw new Error(`Colonne manquante pour la table ${table}: ${col}`)
      }
    }

    const columns = definedColumns

    const sql = `
      INSERT INTO ${table}
      (${columns.join(', ')})
      VALUES (${columns.map(c => `@${c}`).join(', ')})
    `

    const stmt = db.prepare(sql)
    stmt.run(data)
  }

  /* =========================
     Query générique
     ========================= */
  function query(sql, params = {}) {
    return db.prepare(sql).all(params)
  }

  /* =========================
     Nettoyage optionnel
     ========================= */
  function cleanup(table, days = 365) {
    const cutoff = Date.now() - days * 86400000
    db.prepare(
      `DELETE FROM ${table} WHERE timestamp < ?`
    ).run(cutoff)
  }

  // Méthodes style Symfony pour simplifier l'accès aux données
  function findAll(table, options = {}) {
    const { limit = 100, offset = 0, order = 'desc', filters = {} } = options
    
    // Construire la requête de base
    let sql = `SELECT device_id, value, timestamp FROM ${table}`
    const params = []
    const conditions = []

    // Ajouter les filtres
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value.operator) {
          // Support pour les opérateurs comme { operator: '>=', value: 100 }
          conditions.push(`${key} ${value.operator} @${key}`)
          params.push(value.value)
        } else {
          // Filtre simple égalité
          conditions.push(`${key} = @${key}`)
          params.push(value)
        }
      }
    })

    // Ajouter les conditions à la requête
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    // Ajouter le tri
    const validOrders = ['asc', 'desc']
    const sortOrder = validOrders.includes(order) ? order.toUpperCase() : 'DESC'
    sql += ` ORDER BY timestamp ${sortOrder}`

    // Ajouter la limite et l'offset
    sql += ' LIMIT @limit OFFSET @offset'
    params.push(limit, offset)

    return query(sql, {
      ...filters,
      limit,
      offset
    })
  }

  function findBy(table, criteria, options = {}) {
    const { limit = 100, offset = 0, order = 'desc' } = options
    
    // Construire la requête de base
    let sql = `SELECT device_id, value, timestamp FROM ${table}`
    const conditions = []

    // Ajouter les critères
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value.operator) {
          // Support pour les opérateurs comme { operator: '>=', value: 100 }
          conditions.push(`${key} ${value.operator} @${key}`)
        } else {
          // Critère simple égalité
          conditions.push(`${key} = @${key}`)
        }
      }
    })

    // Ajouter les conditions à la requête
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    // Ajouter le tri
    const validOrders = ['asc', 'desc']
    const sortOrder = validOrders.includes(order) ? order.toUpperCase() : 'DESC'
    sql += ` ORDER BY timestamp ${sortOrder}`

    // Ajouter la limite et l'offset
    sql += ' LIMIT @limit OFFSET @offset'

    return query(sql, {
      ...criteria,
      limit,
      offset
    })
  }

  function findOneBy(table, criteria) {
    const result = findBy(table, criteria, { limit: 1 })
    return result.length > 0 ? result[0] : null
  }

  // Méthode pour récupérer la liste des tables
  function getTables() {
    return Object.keys(cfg.tables)
  }

  fastify.decorate('sqlite', {
    writePoint,
    query,
    cleanup,
    config: cfg,
    // Méthodes style Symfony
    findAll,
    findBy,
    findOneBy,
    // Méthode pour lister les tables
    getTables
  })

  fastify.addHook('onClose', async () => {
    db.close()
  })

}, { name: 'sqlite' })
