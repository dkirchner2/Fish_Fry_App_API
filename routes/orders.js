const express = require('express');
const pool = require('../db').db;
const db = pool;
const router = express.Router();
const verify = require('../middleware/verify.js');
const isAdmin = require('../middleware/roles.js');

function getAlacarteSQL(orderID, alacarteItems) {
    sql = 'INSERT INTO orderitems (orderid, foodid, created, updated) VALUES ';
    for (const [idx, item] of alacarteItems.entries()) {
        if (idx === alacarteItems.length - 1) {
            sql += `(${orderID}, ${item.order.foodID}, current_timestamp, current_timestamp)`
        } else {
            sql += `(${orderID}, ${item.order.foodID}, current_timestamp, current_timestamp),`
        }
    }
    sql += ' RETURNING *';
    return sql;
}

function getMealSQL(orderID, mealItems) {
    sql_arr = [];
    for (const [idx, item] of mealItems.entries()) {
        sql = `WITH ins1 AS (INSERT INTO orderitems (orderid, foodid, created, updated) VALUES (${orderID}, ${item.foodID}, current_timestamp, current_timestamp) RETURNING orderitemid), ins2 AS (INSERT INTO meals (orderitemid, isworkermeal, created, updated) VALUES ((SELECT orderitemid FROM ins1), ${item.isWorkerMeal}, current_timestamp, current_timestamp) RETURNING mealid) INSERT INTO mealitems (mealid, foodid, created, updated) VALUES `

        allMealItems = item.order.entrees.concat(item.order.sides, item.order.extras);
        for (const[i, foodItem] of allMealItems.entries()) {
            if (i === allMealItems.length - 1) {
                sql += `((SELECT mealid FROM ins2), ${foodItem.foodID}, current_timestamp, current_timestamp)`
            } else {
                sql += `((SELECT mealid FROM ins2), ${foodItem.foodID}, current_timestamp, current_timestamp),`
            }
        }
        sql_arr.push(sql);
    }
    return sql_arr;
}

function prettifyMeals(meals) {
    let result = {
        entrees: [],
        sides: [], 
        extras: []
    }
    console.log(meals);
    for (const meal of meals) {
        if (meal.type === 'entree') {
            result.entrees.push(meal.foodname);
        } else if (meal.type === 'side') {
            result.sides.push(meal.foodname);
        } else {
            result.extras.push(meal.foodname);
        }
    }
    return result;
}

function prettifyOrderResults(result, mealResults) {
    prettyOrders = []
    for (const item of result) {
        let existingOrderEntry = prettyOrders.filter(el => el.orderId === item.orderid);
        if (existingOrderEntry.length === 0) {
            let newOrder = {orderId: item.orderid, name: item.custname, orderItems: [], totalCost: item.totalprice, status: item.status}
            if (item.mealid) {
                const mealMatches = mealResults.filter(i => i.mealid === item.mealid);
                if (mealMatches) {
                    const prettyMeals = prettifyMeals(mealMatches[0].result);
                    newOrder.orderItems.push(prettyMeals);
                }
            } else {
                newOrder.orderItems.push(item.foodname);
            }
            prettyOrders.push(newOrder);
        } else {
            prettyOrders = prettyOrders.filter(i => i.orderId !== item.orderid);
            if (item.mealid) {
                const mealMatches = mealResults.filter(i => i.mealid === item.mealid);
                if (mealMatches) {
                    const prettyMeals = prettifyMeals(mealMatches[0].result);
                    existingOrderEntry[0].orderItems.push(prettyMeals);
                }
            } else {
                existingOrderEntry[0].orderItems.push(item.foodname);
            }
            prettyOrders.push(existingOrderEntry[0]);
        }
    }
    return prettyOrders;
}

router.get('/', verify, async (req, res) => {
    const client = await pool.connect();
    try {       
        await client.query('BEGIN');
        const result = await client.query('SELECT o.orderid, o.name AS custname, o.totalprice, o.status, i.orderitemid, i.foodid, f.name AS foodname, f.price, f.type, m.mealid FROM orders o INNER JOIN orderitems i ON o.orderid = i.orderid INNER JOIN fooditems f ON i.foodid = f.foodid LEFT JOIN meals m ON m.orderitemid = i.orderitemid');
        const mealItems = result.rows.filter(i => i.type === 'meal');
        let mealResults = []
        for (const meal of mealItems) {
            const mealResult = await client.query('SELECT m.mealid, f.name AS foodname, f.type FROM mealitems m INNER JOIN fooditems f ON m.foodid = f.foodid WHERE mealid = $1', [meal.mealid])
            mealResults.push({mealid: meal.mealid, result: mealResult.rows});
        }
        await client.query('COMMIT');
        res.status(200).json(prettifyOrderResults(result.rows, mealResults));
    } catch (err) {
        console.log(err);
        await client.query('ROLLBACK');
        res.status(500).json({message: 'Error fetching orders'});
    } finally {
        client.release();
    }
});

router.get('/active', verify, async (req, res) => {
    const client = await pool.connect();
    try {       
        await client.query('BEGIN');
        const result = await client.query("SELECT o.orderid, o.ordertype, o.name AS custname, o.totalprice, o.status, i.orderitemid, i.foodid, f.name AS foodname, f.price, f.type, m.mealid FROM orders o INNER JOIN orderitems i ON o.orderid = i.orderid INNER JOIN fooditems f ON i.foodid = f.foodid LEFT JOIN meals m ON m.orderitemid = i.orderitemid WHERE o.status <> 'finished' AND o.ordertype = 'drivethru'");
        const mealItems = result.rows.filter(i => i.type === 'meal');
        let mealResults = []
        for (const meal of mealItems) {
            const mealResult = await client.query('SELECT m.mealid, f.name AS foodname, f.type FROM mealitems m INNER JOIN fooditems f ON m.foodid = f.foodid WHERE mealid = $1', [meal.mealid])
            mealResults.push({mealid: meal.mealid, result: mealResult.rows});
        }
        await client.query('COMMIT');
        res.status(200).json(prettifyOrderResults(result.rows, mealResults));
    } catch (err) {
        console.log(err);
        await client.query('ROLLBACK');
        res.status(500).json({message: 'Error fetching orders'});
    } finally {
        client.release();
    }
});

router.get('/stats', verify, isAdmin, async(req, res) => {
    const { startDate, endDate } = req.query;
    console.log('start date: ', startDate);
    console.log('end date: ', endDate);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const totals = await client.query("select ordertype, paymenttype, count(*) as count, sum(totalprice) as total from orders where created >= $1 and created <= $2 group by ordertype, paymenttype", [startDate, endDate]);
        const counts = await client.query(`SELECT count(*), ordertype, f.name as foodname, mi.mealfoodname
            FROM orders o INNER JOIN orderitems i ON o.orderid = i.orderid 
            INNER JOIN fooditems f ON i.foodid = f.foodid 
            LEFT JOIN meals m ON m.orderitemid = i.orderitemid
            left join (SELECT mm.mealid, fm.name AS mealfoodname, fm.type as mealfoodtype FROM mealitems mm INNER JOIN fooditems fm ON mm.foodid = fm.foodid) mi
            on m.mealid = mi.mealid
            where type = 'entree' or mi.mealfoodtype = 'entree'
            and o.created >= $1 and o.created <= $2
            group by ordertype, foodname, mealfoodname`, [startDate, endDate]);
        await client.query('COMMIT');
        res.status(200).json({totals: totals.rows, counts: counts.rows})
    } catch (err) {
        console.log(err);
        await client.query('ROLLBACK');
        res.status(500).json({message: 'Error fetching stats'});
    } finally {
        client.release();
    }
});

router.put('/status/:id', verify, async (req, res) => {
    const { status } = req.body;
    const orderID = parseInt(req.params.id);
    try {
        await db.query('UPDATE orders SET status = $1, updated = current_timestamp WHERE orderid = $2', [status, orderID]);
        res.status(200).json({message: `Successfully updated status of order ${orderID} to ${status}`})
    }  catch (err) {
        console.log(err);
        res.status(500).json({message: 'Error changing status'})
    }
});

router.post('/', verify, async (req, res) => {
    const { name, orderType, totalPrice, paymentType, status, items } = req.body;
    const alacarteItems = items.filter(i => i.itemType === 'alacarte');
    const mealItems = items.filter(i => i.itemType === 'meal');
    const client = await pool.connect();
    try {
         await client.query('BEGIN');
         const result = await client.query('INSERT INTO orders (name, ordertype, totalprice, paymenttype, status, created, updated) VALUES ($1, $2, $3, $4, $5, current_timestamp, current_timestamp) RETURNING *', [name, orderType, totalPrice, paymentType, status])
         const alacarteSQL = getAlacarteSQL(result.rows[0].orderid, alacarteItems);
         await client.query(alacarteSQL);
         const sqlArr = getMealSQL(result.rows[0].orderid, mealItems);
         for (const query of sqlArr) {
             await client.query(query);
         }
         await client.query('COMMIT');
         res.status(200).json({message: `Successfully added order with id ${result.rows[0].orderid}`});
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({message:'Error adding order'});
        console.log(err);
    } finally {
        client.release();
    }
});

module.exports = router;