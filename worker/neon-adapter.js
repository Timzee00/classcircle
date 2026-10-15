/**
 * PostgreSQL compatibility layer for ClassCircle's D1-style API.
 * Uses a request-scoped Neon client, parameterized queries and real transactions.
 * This is an adaptation — not a direct SQLite database-connection substitution.
 */
export function convertSqliteSql(query) {
  if (typeof query !== 'string' || !query.trim()) throw new Error('SQL is required');
  let sql = query.trim();
  const ignore = /^INSERT OR IGNORE INTO\s/i.test(sql);
  if (ignore) sql = sql.replace(/^INSERT OR IGNORE INTO\s/i, 'INSERT INTO ');
  // SQLite uses '?' bind markers. SQL here is owned by the app; all user data
  // remains in separate parameter values and is NEVER interpolated into SQL.
  let count = 0;
  sql = sql.replace(/\?/g, () => '$' + (++count));
  if (ignore) sql += ' ON CONFLICT DO NOTHING';
  return sql;
}

export function createPostgresD1Adapter(client) {
  function prepare(query) {
    return {
      bind(...params) {
        const sql = convertSqliteSql(query);
        return {
          sql,
          params,
          async first() {
            const result = await client.query(sql, params);
            return result.rows[0] ?? null;
          },
          async all() {
            const result = await client.query(sql, params);
            return { results: result.rows };
          },
          async run() {
            const result = await client.query(sql, params);
            return { success: true, meta: { changes: result.rowCount || 0 } };
          }
        };
      }
    };
  }

  async function batch(statements) {
    // D1 batch executes atomically; preserve the same guarantee with PG.
    await client.query('BEGIN');
    try {
      const results = [];
      for (const s of statements) {
        if (!s || typeof s.sql !== 'string' || !Array.isArray(s.params)) {
          throw new Error('Invalid prepared batch statement');
        }
        const res = await client.query(s.sql, s.params);
        results.push({ results: res.rows, meta: { changes: res.rowCount || 0 } });
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return { prepare, batch };
}
