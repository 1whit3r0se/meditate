import express from "express"
import { sql } from "@vercel/postgres"
import dotenv from "dotenv"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"

dotenv.config()

function extractKeywords(text) {
  return text.toLowerCase().match(/\b(\w+)\b/g) || []
}

const app = express()

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))

async function initializeDatabase() {
  try {
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'knowledge_base'
      );
    `;

    if (!tableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "knowledge_base" (
          "id" SERIAL PRIMARY KEY,
          "title" TEXT,
          "question" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log("Created knowledge_base table");
    } else {
      // Check if question column exists
      const questionColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'knowledge_base' AND column_name = 'question'
        );
      `;
      
      // Add question column if it doesn't exist
      if (!questionColumnExists.rows[0].exists) {
        await sql`
          ALTER TABLE "knowledge_base" ADD COLUMN "question" TEXT NOT NULL DEFAULT '';
        `;
        console.log("Added 'question' column to knowledge_base table");
      }
    }

    // Ensure the 'content' column exists
    const contentColumnExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'content'
      );
    `;

    if (!contentColumnExists.rows[0].exists) {
      await sql`
        ALTER TABLE "knowledge_base" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
      `;
      console.log("Added 'content' column to knowledge_base table");
    }

    // Create or replace the full-text search index
    await sql`
      DROP INDEX IF EXISTS idx_fts;
      CREATE INDEX idx_fts ON "knowledge_base" USING GIN (to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("question", '') || ' ' || "content"));
    `;

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initializeDatabase()

app.post("/api/chat", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const keywords = extractKeywords(query)
    const searchQuery = keywords.join(" | ")

    const result = await sql`
      SELECT "id", "title", "question", "content",
             ts_rank(to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("question", '') || ' ' || "content"), to_tsquery('english', ${searchQuery})) AS rank
      FROM "knowledge_base"
      WHERE to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("question", '') || ' ' || "content") @@ to_tsquery('english', ${searchQuery})
      ORDER BY rank DESC
      LIMIT 5
    `

    if (result.rows.length > 0) {
      return res.json({ articles: result.rows })
    } else {
      return res.json({ articles: [] })
    }
  } catch (error) {
    console.error("Error querying database:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/admin/knowledge", async (req, res) => {
  const { title, content, question } = req.body

  if (!title || !content || !question) {
    return res.status(400).json({ error: "Title, question, and content are required" })
  }

  try {
    await sql`
      INSERT INTO "knowledge_base" ("title", "content", "question") 
      VALUES (${title}, ${content}, ${question})
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
      SELECT "id", "title", "question", "content" FROM "knowledge_base" 
      ORDER BY "id" DESC
    `

    return res.json({ knowledge: result.rows })
  } catch (error) {
    console.error("Error fetching knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.delete("/api/admin/knowledge/:id", async (req, res) => {
  const { id } = req.params

  try {
    await sql`DELETE FROM "knowledge_base" WHERE "id" = ${id}`

    return res.json({ message: "Knowledge deleted successfully" })
  } catch (error) {
    console.error("Error deleting knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicPath = path.join(__dirname, "..", "public")

app.use(express.static(publicPath))

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"))
})

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
