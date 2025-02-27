import express from "express"
import { sql } from "@vercel/postgres"
import dotenv from "dotenv"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"

// Load environment variables
dotenv.config()

// Simple keyword extraction function
function extractKeywords(text) {
  return text.toLowerCase().match(/\b(\w+)\b/g) || []
}

const app = express()

// Middleware
app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))

// Initialize database
async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fts ON knowledge_base USING GIN (to_tsvector('english', question || ' ' || answer))
    `
    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}

// Initialize the database when the app starts
initializeDatabase()

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const keywords = extractKeywords(query)
    const searchQuery = keywords.join(" | ")

    const result = await sql`
      SELECT id, question, answer,
             ts_rank(to_tsvector('english', question || ' ' || answer), to_tsquery('english', ${searchQuery})) AS rank
      FROM knowledge_base
      WHERE to_tsvector('english', question || ' ' || answer) @@ to_tsquery('english', ${searchQuery})
      ORDER BY rank DESC
      LIMIT 1
    `

    if (result.rows.length > 0) {
      return res.json({ answer: result.rows[0].answer })
    } else {
      // Fallback to LIKE query if no results found
      const fallbackResult = await sql`
        SELECT answer FROM knowledge_base 
        WHERE question ILIKE ${`%${query}%`}
        LIMIT 1
      `

      if (fallbackResult.rows.length > 0) {
        return res.json({ answer: fallbackResult.rows[0].answer })
      } else {
        return res.json({ answer: "Sorry, I couldn't find an answer to that." })
      }
    }
  } catch (error) {
    console.error("Error querying database:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Admin endpoints for managing the knowledge base
app.post("/api/admin/knowledge", async (req, res) => {
  const { question, answer } = req.body

  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required" })
  }

  try {
    await sql`
      INSERT INTO knowledge_base (question, answer) 
      VALUES (${question}, ${answer})
    `

    return res.status(201).json({ message: "Knowledge added successfully" })
  } catch (error) {
    console.error("Error adding knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/admin/knowledge", async (req, res) => {
  try {
    const result = await sql`
      SELECT id, question, answer FROM knowledge_base 
      ORDER BY id DESC
    `

    return res.json({ knowledge: result.rows })
  } catch (error) {
    console.error("Error fetching knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Delete knowledge entry
app.delete("/api/admin/knowledge/:id", async (req, res) => {
  const { id } = req.params

  try {
    await sql`DELETE FROM knowledge_base WHERE id = ${id}`

    return res.json({ message: "Knowledge deleted successfully" })
  } catch (error) {
    console.error("Error deleting knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Serve static files from the public directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicPath = path.join(__dirname, "..", "public")

app.use(express.static(publicPath))

// Serve the admin interface
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"))
})

// Serve the chat interface
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"))
})

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

export default app

