import express from "express"
import { sql } from "@vercel/postgres"
import dotenv from "dotenv"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"

dotenv.config()

const app = express()

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))

// Improved error logging
function logError(error, context) {
  console.error(`Error in ${context}:`, error)
  console.error("Error details:", JSON.stringify(error, null, 2))
}

// Wrap database queries in a try-catch block
async function executeQuery(query, params, context) {
  try {
    return await sql.query(query, params)
  } catch (error) {
    logError(error, context)
    throw error
  }
}

// Improved search query
app.post("/api/search", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const result = await executeQuery(
      `
      SELECT "id", "title", "question", "answer", "content",
             ts_rank(to_tsvector('english', 
               COALESCE("title", '') || ' ' || 
               COALESCE("question", '') || ' ' || 
               COALESCE("answer", '') || ' ' || 
               COALESCE("content", '')
             ), plainto_tsquery('english', $1)) AS rank
      FROM "knowledge_base"
      WHERE to_tsvector('english', 
        COALESCE("title", '') || ' ' || 
        COALESCE("question", '') || ' ' || 
        COALESCE("answer", '') || ' ' || 
        COALESCE("content", '')
      ) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT 10
    `,
      [query],
      "search query",
    )

    return res.json({ articles: result.rows })
  } catch (error) {
    logError(error, "search query")
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Autocomplete endpoint
app.post("/api/autocomplete", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const result = await executeQuery(
      `
      SELECT "id", "title", "question"
      FROM "knowledge_base"
      WHERE to_tsvector('english', 
        COALESCE("title", '') || ' ' || 
        COALESCE("question", '')
      ) @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(to_tsvector('english', 
        COALESCE("title", '') || ' ' || 
        COALESCE("question", '')
      ), plainto_tsquery('english', $1)) DESC
      LIMIT 5
    `,
      [query],
      "autocomplete query",
    )

    return res.json({ suggestions: result.rows })
  } catch (error) {
    logError(error, "autocomplete query")
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Add knowledge
app.post("/api/admin/knowledge", async (req, res) => {
  const { title, content, question, answer } = req.body

  if (!title || !content || !question || !answer) {
    return res.status(400).json({ error: "Title, question, answer, and content are required" })
  }

  try {
    await executeQuery(
      `
      INSERT INTO "knowledge_base" ("title", "content", "question", "answer") 
      VALUES ($1, $2, $3, $4)
    `,
      [title, content, question, answer],
      "add knowledge",
    )

    return res.status(201).json({ message: "Knowledge added successfully" })
  } catch (error) {
    logError(error, "add knowledge")
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Get all knowledge
app.get("/api/admin/knowledge", async (req, res) => {
  try {
    const result = await executeQuery(
      `
      SELECT "id", "title", "question", "answer", "content" FROM "knowledge_base" 
      ORDER BY "id" DESC
    `,
      [],
      "get all knowledge",
    )

    return res.json({ knowledge: result.rows })
  } catch (error) {
    logError(error, "get all knowledge")
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Delete knowledge
app.delete("/api/admin/knowledge/:id", async (req, res) => {
  const { id } = req.params

  try {
    await executeQuery(`DELETE FROM "knowledge_base" WHERE "id" = $1`, [id], "delete knowledge")

    return res.json({ message: "Knowledge deleted successfully" })
  } catch (error) {
    logError(error, "delete knowledge")
    return res.status(500).json({ error: "Internal server error" })
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicPath = path.join(__dirname, "..", "public")

app.use(express.static(publicPath))

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"))
})

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

export default app

