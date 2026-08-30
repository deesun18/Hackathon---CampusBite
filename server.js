require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors());
app.use(express.json());


// =========================
// GEMINI SETUP
// =========================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
});


// =========================
// MYSQL CONNECTION
// =========================

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "campusbite"
});

db.connect((error) => {
    if (error) {
        console.error("MySQL connection failed:", error);
        return;
    }

    console.log("Connected to MySQL!");
});


// =========================
// GET NIGHT CANTEEN MENU
// =========================

app.get("/api/night-canteen-menu", (req, res) => {

    const sql = `
        SELECT
            id,
            name,
            calories,
            protein,
            carbs,
            fat,
            price,
            vegetarian
        FROM menu_items
        WHERE cafeteria_id = 1
    `;

    db.query(sql, (error, results) => {

        if (error) {
            console.error("Database error:", error);

            return res.status(500).json({
                error: "Failed to fetch night canteen menu"
            });
        }

        console.log("NIGHT CANTEEN MENU:", results);

        res.json(results);
    });

});


// =========================
// ASK GEMINI FOR RECOMMENDATION
// =========================

app.post("/api/recommend", (req, res) => {

    const userRequest = req.body.request;

    if (!userRequest) {
        return res.status(400).json({
            error: "Please provide a request"
        });
    }

    const sql = `
        SELECT
            id,
            name,
            calories,
            protein,
            carbs,
            fat,
            price,
            vegetarian
        FROM menu_items
        WHERE cafeteria_id = 1
    `;

    db.query(sql, async (error, results) => {

        if (error) {
            console.error("Database error:", error);

            return res.status(500).json({
                error: "Failed to fetch menu"
            });
        }

        console.log("MENU SENT TO GEMINI:", results);


        // Convert the MySQL rows into text

        const menu = results.map(item => `
Name: ${item.name}
Calories: ${item.calories}
Protein: ${item.protein}g
Carbs: ${item.carbs}g
Fat: ${item.fat}g
Price: ${item.price}
Vegetarian: ${item.vegetarian ? "Yes" : "No"}
`).join("\n");


        console.log("MENU TEXT:");
        console.log(menu);


        // Give Gemini the menu

        const prompt = `
You are a cafeteria food recommendation assistant.

IMPORTANT:
You MUST ONLY recommend food items that appear in the menu below.
Do NOT invent, assume, or use outside knowledge about menu items.

NIGHT CANTEEN MENU:
${menu}

USER REQUEST:
${userRequest}

Recommend suitable items from the Night Canteen menu.

Clearly mention the exact name of each recommended item.
Give a short explanation of why it matches the user's request.
`;


        try {

            console.log("Sending request to Gemini...");

            const result = await model.generateContent(prompt);

            const response = result.response.text();

            console.log("GEMINI RESPONSE:");
            console.log(response);

            res.json({
                recommendation: response
            });

        } catch (geminiError) {

            console.error("Gemini error:", geminiError);

            res.status(500).json({
                error: "Failed to get recommendation from Gemini"
            });

        }

    });

});


// =========================
// START SERVER
// =========================

app.listen(5000, () => {

    console.log("Server running on http://localhost:5000");

});