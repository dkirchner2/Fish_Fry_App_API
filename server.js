const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();

require('dotenv').config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send("<h1>It's alive!!!</h1>");
});

const ordersRoute = require('./routes/orders');
const usersRoute = require('./routes/users');
const foodItemsRoute = require('./routes/food_items');

app.use('/orders', ordersRoute);
app.use('/users', usersRoute);
app.use('/items', foodItemsRoute);

const port = process.env.PORT;

app.listen(port);