const express = require('express');
const db = require('../db').db;
const router = express.Router();
const verify = require('../middleware/verify.js');
const isAdmin = require('../middleware/roles.js');


router.get('/', verify, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM fooditems WHERE deleted <> true');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({message: 'Error fetching food items'});
    }
});

router.get('/meals', verify, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM fooditems WHERE type = 'meal'");
        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Error fetching meals'});
    }
});

router.post('/', verify, isAdmin, async (req, res) => {
    try {
        const { name, price, type, mealprice, deleted } = req.body;
        const result = await db.query('INSERT INTO fooditems (name, price, type, mealprice, deleted, created, updated) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', [name, price, type, mealprice, deleted]);
        res.status(200).json({message: `Food item with ID ${result.rows[0].foodid} added successfully`});
    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Error adding food item'});
    }
});

router.put('/:id', verify, isAdmin, async (req, res) => {
    const foodID = parseInt(req.params.id);
    try {
        const { name, price, type, mealprice, deleted } = req.body;
        const result = await db.query('UPDATE fooditems SET name = $1, price = $2, type = $3, mealprice = $4, deleted = $5, updated = CURRENT_TIMESTAMP WHERE foodid = $6', [name, price, type, mealprice, deleted, foodID]);
        res.status(200).json({message: `Food item with ID ${foodID} successfully updated`})
    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Error updating food item'});
    }
});

module.exports = router;