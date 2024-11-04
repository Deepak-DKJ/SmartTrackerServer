const express = require('express');
const cors = require("cors");
const app = express.Router();
require('dotenv').config();
app.use(cors(
    {
        origin: ["https://test-gen-ai.vercel.app", "http://localhost:3000"],
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

const formatDate = (dateString) => {
    const date = new Date(dateString);
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
    res.json(data)
})

app.get("/getprofile", fetchUserFromToken, async (req, res) => {
    // console.log(req.ID)
    const tests = await Test.find({ user: req.ID })
    let data = {}
    const total = tests.length;
    let pending = 0
    for (const ind in tests) {
        const test = tests[ind]
        if (test.scores.selfscore === -1000)
            pending++;
    }
    data["total"] = total
    data["pending"] = pending
    res.json(data)
})

app.get("/gettest/:id", fetchUserFromToken, async (req, res) => {
    try {
        const userid = req.ID; // Extract user ID from middleware
        const testId = req.params.id; // Extract test ID from URL params

        const test = await Test.findOne({ _id: testId, user: userid });

        if (!test) {
            return res.status(404).json({ error: "Test not found or unauthorized" });
        }

        const data = {
            "testTitle": test.testtitle,
            "testDuration": test.testduration,
            "questions": test.questions,
            "crtAnswer": test.correctanswerpoints,
            "negMarking": test.negativemarking,
            "score": test.scores.selfscore,
            "total": test.scores.totalscore,
            "correct": test.scores.correct,
            "wrong": test.scores.wrong
        }

        res.status(200).json({ "testDetails": data });
        return
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
})

app.post("/additem", fetchUserFromToken, async (req, res) => {
    try {
        const _id = req.ID
        const input_data = req.body.inp
        const dt = req.body.date
        console.log(dt)

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
        
        console.log(input_data)
        console.log(process.env.API_KEY)
        const result = await model.generateContent(prompt);
        let dat = result.response.text()
        dat = dat.replace(/^\s+|\s+$/g, '');
        console.log("AI RESPONSE: ", dat);
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
                item_details[fieldName] = fieldData;
        }
        
        item_details["user"] = _id
        item_details["date"] = dt
        console.log(item_details)

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

app.put("/updatetest/:id", fetchUserFromToken, async (req, res) => {
    try {
        const userid = req.ID; // Extract user ID from middleware
        const testId = req.params.id; // Extract test ID from URL params
        // console.log(req.body)
        const details = req.body; // New data with responses

        const test = await Test.findOne({ _id: testId, user: userid });

        if (!test) {
            return res.status(404).json({ error: "Test not found or unauthorized" });
        }

        if ("testScore" in details) {
            test.questions = details.updatedQuestionsList
            test.scores.selfscore = details.testScore
            test.scores.correct = details.correctQsns
            test.scores.wrong = details.wrongQsns
        }
        else {
            test.testtitle = details.title
            test.testduration = details.duration
            test.correctanswerpoints = details.correctMarks;
            test.negativemarking = details.negMarks;
            test.scores.totalscore = (details.qsCount) * (details.correctMarks)
        }
        await test.save();

        res.status(200).json({ message: "Test updated successfully" });
        return
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
})

app.delete("/deletetest/:id", fetchUserFromToken, async (req, res) => {
    try {
        const _id = req.ID; // Extract user ID from middleware
        const testId = req.params.id; // Extract test ID from URL params

        // Find the test and delete it if it belongs to the authenticated user
        const deletedTest = await Test.findOneAndDelete({ _id: testId, user: _id });

        // Check if the test was found and deleted
        if (!deletedTest) {
            return res.status(404).json({ error: "Test not found or unauthorized" });
        }

        return res.status(200).json({
            message: "Test deleted successfully",
            test: deletedTest
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
})

module.exports = app