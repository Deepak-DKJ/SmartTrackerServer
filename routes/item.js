const express = require('express');
const cors = require("cors");
const app = express.Router();
require('dotenv').config();
app.use(cors(
    {
        origin: ["https://item-gen-ai.vercel.app", "http://localhost:3000", "http://192.168.1.116:3000"],
        methods: ["POST", "GET", "PUT", "DELETE"],
        credentials: true
    }
))

const User = require('../models/User')

const Item = require('../models/ItemDetails');
const fetchUserFromToken = require('../middleware/getUserDetails');

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });

const formatDate = (daitemring) => {
    const date = new Date(daitemring);
    const day = String(date.getDate()).padStart(2, '0'); // Add leading zero
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Add leading zero
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

app.get("/getallitems", fetchUserFromToken, async (req, res) => {
    const items = await Item.find({ user: req.ID })
    let data = {}
    for (const item of items) {
        const formattedDate = formatDate(item.date);

        if (!data[formattedDate]) {
            data[formattedDate] = [];
        }

        const entry = {
            itemId: item._id,
            itemName: item.itemName,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            type: item.type,
            category: item.category
        };

        data[formattedDate].push(entry);
    }
    for (const date in data) {
        data[date].reverse();
    }
    res.json(data)
})

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

app.post("/additem", fetchUserFromToken, async (req, res) => {
    try {
        const _id = req.ID
        const input_data = req.body.inp
        const dt = req.body.date
        // console.log(dt)

        let prompt = `You are given the following categories for type 'Expense': Groceries, Household, Travel & Fuel, Healthcare, Entertainment, Shopping, Premium or Others.
        And for type 'Earning': Salary, Savings, Investments, Rental Income, Refunds, Pensions or Others.

        Please extract the following details from the input text and provide the output as a single string, with each field separated by a dollar sign ($) in the following order:
        1. Item name
        2. Type: either 'Earning' or 'Expense'
        3. Quantity
        4. Total Price (extract only value as currency is always rupees)
        5. Category

        If you are NOT sure in any field, return 'NA' for that field. 
        Output format: "Itemname$Quantity$TotalPrice$Type$Category"

        Example: "Char litre dudh assi rupya"
        Output: "dudh$4 litre$80$Expense$Groceries"

        Input text: "${input_data}"`;
        
        const result = await model.generateContent(prompt);
        let dat = result.response.text()
        dat = dat.replace(/^\s+|\s+$/g, '');
        // console.log("AI RESPONSE: ", dat);
        let fields = dat.split("$").filter(line => line.trim() !== "");

        if (fields.length !== 5) {
            return res.status(500).json({
                message: "Could not generate data for the entry",
                airesp: dat
            });
        }

        let item_details = {}
        const fieldNames = ["itemName", "quantity", "totalPrice", "type", "category"]

        for(const ind in fieldNames)
        {
            const fieldName = fieldNames[ind];
            let fieldData = fields[ind];
            if(fieldData.trim() !== "NA")
            {
                if(Number(ind) === 0)
                fieldData = capitalizeFirstLetter(fieldData)
                item_details[fieldName] = fieldData;
                    
            }    
            else
            {
                if(Number(ind) == 2)
                {
                    return res.status(500).json({ error: `Couldn't add entry as amount not found!` });
                }
            }
        }
        
        item_details["user"] = _id
        item_details["date"] = dt
        // console.log(item_details)

        // Create a new item entry
        const newItem = new Item(item_details);

        // Save the item into the database
        const savedItem = await newItem.save();
        return res.status(200).json({
            message: "Item added successfully",
            // qsns: questions.length,
            item : savedItem,
            item_id: savedItem._id
        });

    } catch (error) {
        console.error(error.message);
        // return res.status(500).json({ error: "Internal Server Error" });
        return res.status(500).json({ error: error.message });
    }
})

app.put("/updateitem/:id", fetchUserFromToken, async (req, res) => {
    try {
        const userid = req.ID; // Extract user ID from middleware
        const itemId = req.params.id; // Extract item ID from URL params
        // console.log(req.body)
        const details = req.body; // New data with responses
        // console.log(details)
        const item = await Item.findOne({ _id: itemId, user: userid });

        if (!item) {
            return res.status(404).json({ error: "Item not found or unauthorized" });
        }

        
        item.itemName = details.name
        item.quantity = details.quant
        item.totalPrice = details.amt;
        item.type = details.type;
        item.category = details.catry
        
        await item.save();

        res.status(200).json({ message: "item updated successfully" });
        return
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
})

app.delete("/deleteitem/:id", fetchUserFromToken, async (req, res) => {
    try {
        const _id = req.ID; // Extract user ID from middleware
        const itemId = req.params.id; // Extract item ID from URL params

        // Find the item and delete it if it belongs to the authenticated user
        const deleteditem = await Item.findOneAndDelete({ _id: itemId, user: _id });

        // Check if the item was found and deleted
        if (!deleteditem) {
            return res.status(404).json({ error: "item not found or unauthorized" });
        }

        return res.status(200).json({
            message: "item deleted successfully",
            item: deleteditem
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
})

module.exports = app