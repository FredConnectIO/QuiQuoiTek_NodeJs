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
};
