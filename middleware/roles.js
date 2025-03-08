const db = require('../db').db;
const jwt = require('jsonwebtoken');

async function isAdmin(req, res, next) {

    try {
        const authHeader = req.headers["cookie"];
        if (!authHeader) {
            return res.sendStatus(401);
        }
        let cookie = authHeader.split("SessionID=")[1];
        cookie = cookie.split(';')[0];
        jwt.verify(cookie, process.env.SECRET_ACCESS_TOKEN, async (err, decoded) => {
            if (err) {
                console.log(err);
                return res
                    .status(401)
                    .json({ message: "This session has expired. Please login" });
            }
            const { id } = decoded; 
            const user = await db.query('SELECT * FROM users WHERE userid = $1', [id]);
            if (user.rows[0].role === 'admin') {
                return next();
            }
             else {
                res.status(401).send('Unauthorized')
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error validating role');

    }
}

module.exports = isAdmin;