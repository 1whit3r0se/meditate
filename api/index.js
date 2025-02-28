import express from "express"
import { sql } from "@vercel/postgres"
import dotenv from "dotenv"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import { put, del } from "@vercel/blob"

dotenv.config()

function extractKeywords(text) {
  return text.toLowerCase().match(/\b(\w+)\b/g) || []
}

const app = express()

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))

// Configure multer for memory storage
const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

let databaseInitialized = false

async function initializeDatabase() {
  if (databaseInitialized) return

  try {
    // Check if knowledge_base table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'knowledge_base'
      );
    `

    if (!tableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "knowledge_base" (
          "id" SERIAL PRIMARY KEY,
          "title" TEXT,
          "question" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "image_url" TEXT,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
      console.log("Created knowledge_base table")
    } else {
      // Check if image_url column exists
      const imageUrlColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'knowledge_base' AND column_name = 'image_url'
        );
      `

      // Add image_url column if it doesn't exist
      if (!imageUrlColumnExists.rows[0].exists) {
        await sql`
          ALTER TABLE "knowledge_base" ADD COLUMN "image_url" TEXT;
        `
        console.log("Added 'image_url' column to knowledge_base table")
      }
    }

    // Ensure the 'content' column exists
    const contentColumnExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'content'
      );
    `

    if (!contentColumnExists.rows[0].exists) {
      await sql`
        ALTER TABLE "knowledge_base" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
      `
      console.log("Added 'content' column to knowledge_base table")
    }

    // Check if file_attachments table exists
    const fileTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'file_attachments'
      );
    `

    if (!fileTableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "file_attachments" (
          "id" SERIAL PRIMARY KEY,
          "knowledge_id" INTEGER NOT NULL REFERENCES "knowledge_base"("id") ON DELETE CASCADE,
          "filename" TEXT NOT NULL,
          "blob_url" TEXT NOT NULL,
          "file_size" INTEGER NOT NULL,
          "mime_type" TEXT,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
      console.log("Created file_attachments table")
    }

    // Create or replace the full-text search index
    await sql`
      DROP INDEX IF EXISTS idx_fts;
      CREATE INDEX idx_fts ON "knowledge_base" USING GIN (to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("question", '') || ' ' || "content"));
    `

    console.log("Database initialized successfully")
    databaseInitialized = true
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}

// Middleware to ensure database is initialized
app.use(async (req, res, next) => {
  if (!databaseInitialized) {
    try {
      await initializeDatabase()
      next()
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize database" })
    }
  } else {
    next()
  }
})

app.post("/api/chat", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const keywords = extractKeywords(query)
    const searchQuery = keywords.join(" | ")

    const result = await sql`
      SELECT kb."id", kb."title", kb."question", kb."content", kb."image_url",
             ts_rank(to_tsvector('english', COALESCE(kb."title", '') || ' ' || COALESCE(kb."question", '') || ' ' || kb."content"), to_tsquery('english', ${searchQuery})) AS rank
      FROM "knowledge_base" kb
      WHERE to_tsvector('english', COALESCE(kb."title", '') || ' ' || COALESCE(kb."question", '') || ' ' || kb."content") @@ to_tsquery('english', ${searchQuery})
      ORDER BY rank DESC
      LIMIT 5
    `

    // For each knowledge base entry, get its file attachments
    const articlesWithFiles = await Promise.all(
      result.rows.map(async (article) => {
        const files = await sql`
        SELECT "id", "filename", "blob_url", "file_size", "mime_type" 
        FROM "file_attachments" 
        WHERE "knowledge_id" = ${article.id}
        ORDER BY "created_at" DESC
      `

        return {
          ...article,
          files: files.rows,
        }
      }),
    )

    if (articlesWithFiles.length > 0) {
      return res.json({ articles: articlesWithFiles })
    } else {
      return res.json({ articles: [] })
    }
  } catch (error) {
    console.error("Error querying database:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/admin/knowledge", upload.array("files", 5), async (req, res) => {
  const { title, content, question, image_url } = req.body

  if (!title || !content || !question) {
    return res.status(400).json({ error: "Title, question, and content are required" })
  }

  try {
    // Begin transaction
    await sql`BEGIN`

    // Insert knowledge base entry
    const result = await sql`
      INSERT INTO "knowledge_base" ("title", "content", "question", "image_url") 
      VALUES (${title}, ${content}, ${question}, ${image_url})
      RETURNING "id"
    `

    const knowledgeId = result.rows[0].id

    // Insert file attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const blob = await put(uuidv4(), file.buffer, {
          access: "public",
        })

        await sql`
          INSERT INTO "file_attachments" ("knowledge_id", "filename", "blob_url", "file_size", "mime_type")
          VALUES (${knowledgeId}, ${file.originalname}, ${blob.url}, ${file.size}, ${file.mimetype})
        `
      }
    }

    // Commit transaction
    await sql`COMMIT`

    return res.status(201).json({ message: "Knowledge added successfully", id: knowledgeId })
  } catch (error) {
    // Rollback transaction on error
    await sql`ROLLBACK`
    console.error("Error adding knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/admin/knowledge", async (req, res) => {
  try {
    const result = await sql`
      SELECT "id", "title", "question", "content", "image_url" FROM "knowledge_base" 
      ORDER BY "id" DESC
    `

    // For each knowledge base entry, get the count of file attachments
    const knowledgeWithFileCounts = await Promise.all(
      result.rows.map(async (item) => {
        const fileCount = await sql`
        SELECT COUNT(*) FROM "file_attachments" WHERE "knowledge_id" = ${item.id}
      `

        return {
          ...item,
          file_count: Number.parseInt(fileCount.rows[0].count),
        }
      }),
    )

    return res.json({ knowledge: knowledgeWithFileCounts })
  } catch (error) {
    console.error("Error fetching knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/admin/knowledge/:id", async (req, res) => {
  const { id } = req.params

  try {
    const result = await sql`
      SELECT "id", "title", "question", "content", "image_url" FROM "knowledge_base" 
      WHERE "id" = ${id}
    `

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Knowledge entry not found" })
    }

    // Get file attachments for this knowledge entry
    const files = await sql`
      SELECT "id", "filename", "blob_url", "file_size", "mime_type" 
      FROM "file_attachments" 
      WHERE "knowledge_id" = ${id}
      ORDER BY "created_at" DESC
    `

    return res.json({
      knowledge: result.rows[0],
      files: files.rows,
    })
  } catch (error) {
    console.error("Error fetching knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.put("/api/admin/knowledge/:id", upload.array("files", 5), async (req, res) => {
  const { id } = req.params
  const { title, content, question, image_url } = req.body

  if (!title || !content || !question) {
    return res.status(400).json({ error: "Title, question, and content are required" })
  }

  try {
    // Begin transaction
    await sql`BEGIN`

    // Update knowledge base entry
    await sql`
      UPDATE "knowledge_base" 
      SET "title" = ${title}, "content" = ${content}, "question" = ${question}, "image_url" = ${image_url}
      WHERE "id" = ${id}
    `

    // Insert new file attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const blob = await put(uuidv4(), file.buffer, {
          access: "public",
        })

        await sql`
          INSERT INTO "file_attachments" ("knowledge_id", "filename", "blob_url", "file_size", "mime_type")
          VALUES (${id}, ${file.originalname}, ${blob.url}, ${file.size}, ${file.mimetype})
        `
      }
    }

    // Commit transaction
    await sql`COMMIT`

    return res.json({ message: "Knowledge updated successfully" })
  } catch (error) {
    // Rollback transaction on error
    await sql`ROLLBACK`
    console.error("Error updating knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.delete("/api/admin/knowledge/:id", async (req, res) => {
  const { id } = req.params

  try {
    // Get file URLs before deleting
    const files = await sql`
      SELECT "blob_url" FROM "file_attachments" WHERE "knowledge_id" = ${id}
    `

    // Delete knowledge entry (cascade will delete file records)
    await sql`DELETE FROM "knowledge_base" WHERE "id" = ${id}`

    // Delete files from Vercel Blob Storage
    for (const file of files.rows) {
      await del(file.blob_url)
    }

    return res.json({ message: "Knowledge deleted successfully" })
  } catch (error) {
    console.error("Error deleting knowledge:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// New endpoint to delete a specific file attachment
app.delete("/api/admin/files/:id", async (req, res) => {
  const { id } = req.params

  try {
    // Get file URL before deleting
    const fileResult = await sql`
      SELECT "blob_url" FROM "file_attachments" WHERE "id" = ${id}
    `

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: "File not found" })
    }

    const blobUrl = fileResult.rows[0].blob_url

    // Delete file record
    await sql`DELETE FROM "file_attachments" WHERE "id" = ${id}`

    // Delete file from Vercel Blob Storage
    await del(blobUrl)

    return res.json({ message: "File deleted successfully" })
  } catch (error) {
    console.error("Error deleting file:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// New endpoint to download a file
app.get("/api/files/:id", async (req, res) => {
  const { id } = req.params

  try {
    const fileResult = await sql`
      SELECT "blob_url", "filename", "mime_type" FROM "file_attachments" WHERE "id" = ${id}
    `

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: "File not found" })
    }

    const file = fileResult.rows[0]

    // Redirect to the Vercel Blob URL
    res.redirect(file.blob_url)
  } catch (error) {
    console.error("Error downloading file:", error)
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

