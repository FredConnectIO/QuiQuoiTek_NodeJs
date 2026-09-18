const { Pool } = require('pg');

 const pool = new Pool({
    host:"localhost",
    user:"postgres",
    password:"fred",
    port:5432,
    database:"quiquoitekdb"
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  withTransaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
