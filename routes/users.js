const express = require('express');
const router = express.Router();
const db = require('../db').db;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verify = require('../middleware/verify.js');
const isAdmin = require('../middleware/roles.js');
require('dotenv').config();

router.get('/', verify, isAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({message: 'Error fetching users'});
    }
});


router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const validPassword = bcrypt.compareSync(password, result.rows[0].password);
        if (!validPassword) {
            res.status(401).send('Invalid password');
        } else {
            const token = jwt.sign({ id: result.rows[0].userid },
                process.env.SECRET_ACCESS_TOKEN,
                {
                 algorithm: 'HS256',
                 allowInsecureKeySizes: true,
                 expiresIn: 86400, // 24 hours
                });
            res.cookie('SessionID', token, {
                maxAge: 86400000, 
                httpOnly: true, 
                secure: true,
                path: '/',
                sameSite: 'None', 
             });

            res.status(200).json({username: username, role: result.rows[0].role, login: true});
        }        
    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Login not successful'})
    }
})

router.post('/', verify, isAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const encodedPassword = bcrypt.hashSync(password, 10);
        const result = await db.query('INSERT INTO users (username, password, role, created, updated) VALUES ($1, $2, $3, current_timestamp, current_timestamp)', [username, encodedPassword, role]);
        res.status(200).json({message: `User ${username} successfully created`})
    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Error creating user'});
    }
})

module.exports = router;