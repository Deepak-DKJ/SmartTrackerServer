const jwt = require('jsonwebtoken');
const User = require('../models/User')
let JWT_SECRET_SIGN = "DjIsPrO"

// Middleware to parse an authtoken into a user id
const fetchUserFromToken = (req, res, next) => {
    const Token = req.header("Token")
    if(!Token)
    {
        return res.status(401).send("Please authenticate using a valid token!")
    }
    try {
        const decoded = jwt.verify(Token, JWT_SECRET_SIGN);
        req.ID = decoded.ID
    }
    catch (err) {
        return res.status(401).send("Please authenticate using a valid token!")
    }

    next()
}

module.exports = fetchUserFromToken