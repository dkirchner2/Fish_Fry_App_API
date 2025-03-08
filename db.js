const { Pool } = require('pg');
require('dotenv').config();

const pool = (() => {
    if (process.env.NODE_ENV !== 'prod') {
        return new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            ssl: false
        });
    } else {
        return new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            ssl: {
                rejectUnauthorized: false
              }
        });
    }
})();


module.exports = {
    db: pool
};