const express = require("express");
const app = express();
const cors = require("cors"); 
require('dotenv').config();

app.use(cors(
    {
        origin:["https://smart-tracker-ai.vercel.app", "http://localhost:3000",  "http://192.168.1.116:3000"],
        methods: ["POST", "GET", "PUT", "DELETE"],
        credentials:true
    }
))
//DB configuration
const mongoose = require('mongoose'); 
const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("CONNECTED TO MONGO");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}
connectToMongo();

const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb'}));

// Adding routes for authorization
const authRoutes = require('./routes/auth'); 
app.use('/api/auth', authRoutes); 

// Routes for test details
const itemDetailsRoutes = require('./routes/item');
app.use('/api/items', itemDetailsRoutes)

app.get("/home", (req, res) => {
    console.log(req.body);
    res.send("<h1>Hello World</h1>");
    // res.redirect("/");
});

const PORT = process.env.PORT || 8000;

app.listen(PORT,
    console.log(`Server started on port ${PORT}`)
);