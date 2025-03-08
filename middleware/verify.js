const jwt = require('jsonwebtoken');
const db = require('../db').db;

async function verify(req, res, next) {
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
            const userInfo = user.rows[0];
            res.user = { username: userInfo.username, role: userInfo.role }
            next();
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('Error verifying user');
    }
}

module.exports = verify;