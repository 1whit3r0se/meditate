import express from "express"
import { sql } from "@vercel/postgres"
import cors from "cors"
import { OpenAI } from "openai"
import dotenv from "dotenv"

dotenv.config()

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const app = express()
app.use(cors())
app.use(express.json())

// Initialize database
async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
    console.log("Database initialized")
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}

// Add knowledge to the database
app.post("/api/knowledge", async (req, res) => {
  try {
    const { topic, content } = req.body
    const result = await sql`
      INSERT INTO knowledge_base (topic, content) 
      VALUES (${topic}, ${content}) 
      RETURNING *
    `
    res.json(result.rows[0])
  } catch (error) {
    console.error("Error adding knowledge:", error)
    res.status(500).json({ error: "Failed to add knowledge" })
  }
})

// Get all knowledge topics
app.get("/api/knowledge", async (req, res) => {
  try {
    const result = await sql`SELECT * FROM knowledge_base`
    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching knowledge:", error)
    res.status(500).json({ error: "Failed to fetch knowledge" })
  }
})

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body

    // Fetch relevant knowledge from database
    const knowledgeResult = await sql`SELECT * FROM knowledge_base`
    const knowledgeBase = knowledgeResult.rows

    // Format knowledge as context for the AI
    const knowledgeContext = knowledgeBase.map((k) => `Topic: ${k.topic}\nContent: ${k.content}`).join("\n\n")

    // Generate AI response using OpenAI directly
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant trained on specific knowledge. 
          Use the following information to answer the user's question. 
          If the information doesn't contain the answer, say you don't have that information.
          
          KNOWLEDGE BASE:
          ${knowledgeContext}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 500,
    })

    const text = completion.choices[0].message.content

    // Save to chat history
    await sql`
      INSERT INTO chat_history (user_message, ai_response) 
      VALUES (${message}, ${text})
    `

    res.json({ response: text })
  } catch (error) {
    console.error("Error generating response:", error)
    res.status(500).json({ error: "Failed to generate response" })
  }
})

// Get chat history
app.get("/api/history", async (req, res) => {
  try {
    const result = await sql`
      SELECT * FROM chat_history 
      ORDER BY created_at DESC
    `
    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching chat history:", error)
    res.status(500).json({ error: "Failed to fetch chat history" })
  }
})

// Initialize database on first request
app.use(async (req, res, next) => {
  await initializeDatabase()
  next()
})

// Export the Express API
export default app

