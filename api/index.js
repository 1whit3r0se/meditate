import express from "express"
import { sql } from "@vercel/postgres"
import dotenv from "dotenv"
import cors from "cors"
import { fileURLToPath } from "url"
import path from "path"
import multer from "multer"
import { v4 as uuidv4 } from "uuid"
import { put, del } from "@vercel/blob"
import cookieParser from "cookie-parser"
import { initializeAuthTables, authMiddleware, adminMiddleware, getTokenExpiration } from "./auth.js"

dotenv.config()

function extractKeywords(text) {
  // Extract keywords and preserve phrases in quotes
  const phrases = []
  const quotedRegex = /"([^"]+)"/g
  let match

  // Extract phrases in quotes
  while ((match = quotedRegex.exec(text)) !== null) {
    phrases.push(match[1])
  }

  // Remove quoted phrases from text for individual word extraction
  const remainingText = text.replace(quotedRegex, "")

  // Extract individual words (3+ characters)
  const words = remainingText.toLowerCase().match(/\b(\w{3,})\b/g) || []

  return [...phrases, ...words]
}

const app = express()

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

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
    // Initialize auth tables
    await initializeAuthTables()

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
        )
      `
      console.log("Created knowledge_base table")
    }

    // Check if labs table exists
    const labsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'labs'
      );
    `

    if (!labsTableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "labs" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "owner" TEXT,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log("Created labs table")
    }

    // Check if order column exists in labs table
    const orderColumnExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'labs' AND column_name = 'display_order'
      );
    `

    if (!orderColumnExists.rows[0].exists) {
      await sql`
        ALTER TABLE "labs" ADD COLUMN "display_order" INTEGER DEFAULT 0;
      `
      console.log("Added 'display_order' column to labs table")

      // Set initial order for existing labs
      await sql`
        UPDATE "labs" SET "display_order" = "id" WHERE "display_order" = 0;
      `
    }

    // Check if owner column exists in labs table
    const ownerColumnExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'labs' AND column_name = 'owner'
      );
    `

    if (!ownerColumnExists.rows[0].exists) {
      await sql`
        ALTER TABLE "labs" ADD COLUMN "owner" TEXT;
      `
      console.log("Added 'owner' column to labs table")
    }

    // Check if lab_portals table exists
    const portalsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'lab_portals'
      );
    `

    if (!portalsTableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "lab_portals" (
          "id" SERIAL PRIMARY KEY,
          "lab_id" INTEGER NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
          "name" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "username" TEXT,
          "password" TEXT,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log("Created lab_portals table")
    }

    // Check if lab_nodes table exists
    const nodesTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'lab_nodes'
      );
    `

    if (!nodesTableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "lab_nodes" (
          "id" SERIAL PRIMARY KEY,
          "lab_id" INTEGER NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
          "type" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "ip_address" TEXT,
          "username" TEXT,
          "password" TEXT,
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log("Created lab_nodes table")
    }

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
        )
      `
      console.log("Created file_attachments table")
    }

    // Check if the full-text search index exists
    const indexExists = await sql`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE indexname = 'idx_fts'
      );
    `

    if (!indexExists.rows[0].exists) {
      // Create the full-text search index
      await sql`
        CREATE INDEX idx_fts ON "knowledge_base" USING GIN (to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("question", '') || ' ' || "content"));
      `
      console.log("Created full-text search index")
    }

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

// Authentication routes
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }

  try {
    const result = await sql`
      SELECT * FROM "users" WHERE "email" = ${email}
    `

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = result.rows[0]
    const { hashPassword, verifyPassword, createToken } = await import("./auth.js")

    const isValid = await verifyPassword(password, user.password_hash, user.password_salt)

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = createToken(user)

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    })

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }

  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT * FROM "users" WHERE "email" = ${email}
    `

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" })
    }

    const { hashPassword, createToken } = await import("./auth.js")
    const { hash, salt } = await hashPassword(password)

    const result = await sql`
      INSERT INTO "users" ("email", "password_hash", "password_salt", "role")
      VALUES (${email}, ${hash}, ${salt}, 'user')
      RETURNING "id", "email", "role"
    `

    const user = result.rows[0]
    const token = createToken(user)

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    })

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token")
  return res.json({ success: true })
})

app.get("/api/auth/user", async (req, res) => {
  const token = req.cookies?.token

  if (!token) {
    return res.json({ authenticated: false })
  }

  const { verifyToken } = await import("./auth.js")
  const user = verifyToken(token)

  if (!user) {
    return res.json({ authenticated: false })
  }

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
})

// Add the session info route after the auth/user route
app.get("/api/auth/session", async (req, res) => {
  const token = req.cookies?.token

  if (!token) {
    return res.json({ authenticated: false })
  }

  const { verifyToken } = await import("./auth.js")
  const user = verifyToken(token)

  if (!user) {
    return res.json({ authenticated: false })
  }

  // Get token expiration time
  const expiration = getTokenExpiration(token)

  return res.json({
    authenticated: true,
    expiration: expiration,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
})

app.post("/api/chat", async (req, res) => {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({ error: "Query is required" })
  }

  try {
    const keywords = extractKeywords(query)

    // Improved search query construction
    let searchQuery

    if (keywords.length === 1) {
      // Single keyword search
      searchQuery = keywords[0]
    } else {
      // For multi-word queries, prioritize exact phrases and require at least 2 keywords to match
      const exactPhrases = keywords.filter((k) => k.includes(" ")).map((p) => `"${p}"`)
      const singleWords = keywords.filter((k) => !k.includes(" "))

      if (exactPhrases.length > 0) {
        // If we have exact phrases, prioritize them
        searchQuery = [...exactPhrases, ...singleWords].join(" & ")
      } else {
        // Otherwise, require at least 2 keywords to match (if we have 3+ keywords)
        searchQuery =
          singleWords.length >= 3
            ? `(${singleWords.join(" & ")}) | (${singleWords.join(" | ")})`
            : singleWords.join(" & ")
      }
    }

    // Improved ranking with higher weight for title and question matches
    const result = await sql`
      SELECT kb."id", kb."title", kb."question", kb."content", kb."image_url",
             ts_rank(
               setweight(to_tsvector('english', COALESCE(kb."title", '')), 'A') ||
               setweight(to_tsvector('english', COALESCE(kb."question", '')), 'B') ||
               setweight(to_tsvector('english', kb."content"), 'C'),
               to_tsquery('english', ${searchQuery})
             ) AS rank
      FROM "knowledge_base" kb
      WHERE 
        setweight(to_tsvector('english', COALESCE(kb."title", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(kb."question", '')), 'B') ||
        setweight(to_tsvector('english', kb."content"), 'C')
        @@ to_tsquery('english', ${searchQuery})
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

// Apply auth middleware to admin routes
app.use("/api/admin", authMiddleware, adminMiddleware)

app.post("/api/admin/knowledge", upload.array("files", 5), async (req, res) => {
  const { title, content, question, image_url } = req.body

  console.log("Received knowledge data:", { title, question, content: content?.substring(0, 100) + "...", image_url })

  if (!title || !content || !question) {
    console.log("Missing required fields:", { title: !!title, content: !!content, question: !!question })
    return res.status(400).json({ error: "Title, question, and content are required" })
  }

  try {
    // Begin transaction
    await sql`BEGIN`

    // Insert knowledge base entry
    const result = await sql`
      INSERT INTO "knowledge_base" ("title", "content", "question", "image_url") 
      VALUES (${title}, ${content}, ${question}, ${image_url || null})
      RETURNING "id"
    `

    const knowledgeId = result.rows[0].id
    console.log("Created knowledge entry with ID:", knowledgeId)

    // Insert file attachments if any
    if (req.files && req.files.length > 0) {
      console.log("Processing", req.files.length, "files")
      for (const file of req.files) {
        const blob = await put(uuidv4(), file.buffer, {
          access: "public",
          contentType: file.mimetype,
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
    return res.status(500).json({ error: "Internal server error", details: error.message })
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

  console.log("Updating knowledge", id, "with data:", {
    title,
    question,
    content: content?.substring(0, 100) + "...",
    image_url,
  })

  if (!title || !content || !question) {
    console.log("Missing required fields:", { title: !!title, content: !!content, question: !!question })
    return res.status(400).json({ error: "Title, question, and content are required" })
  }

  try {
    // Begin transaction
    await sql`BEGIN`

    // Update knowledge base entry
    await sql`
      UPDATE "knowledge_base" 
      SET "title" = ${title}, "content" = ${content}, "question" = ${question}, "image_url" = ${image_url || null}
      WHERE "id" = ${id}
    `

    // Insert new file attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const blob = await put(uuidv4(), file.buffer, {
          access: "public",
          contentType: file.mimetype,
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
    return res.status(500).json({ error: "Internal server error", details: error.message })
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

// Labs API routes
app.get("/api/admin/labs", async (req, res) => {
  try {
    const result = await sql`
      SELECT "id", "name", "owner", "display_order", "created_at" FROM "labs" 
      ORDER BY "display_order" ASC, "name" ASC
    `

    return res.json({ labs: result.rows })
  } catch (error) {
    console.error("Error fetching labs:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/admin/labs/:id", async (req, res) => {
  const { id } = req.params

  try {
    const labResult = await sql`
      SELECT "id", "name", "owner", "created_at" FROM "labs" 
      WHERE "id" = ${id}
    `

    if (labResult.rows.length === 0) {
      return res.status(404).json({ error: "Lab not found" })
    }

    const portalsResult = await sql`
      SELECT "id", "name", "url", "username", "password" FROM "lab_portals" 
      WHERE "lab_id" = ${id}
      ORDER BY "name" ASC
    `

    const nodesResult = await sql`
      SELECT "id", "type", "name", "ip_address", "username", "password" FROM "lab_nodes" 
      WHERE "lab_id" = ${id}
      ORDER BY "type", "name" ASC
    `

    return res.json({
      lab: labResult.rows[0],
      portals: portalsResult.rows,
      nodes: nodesResult.rows,
    })
  } catch (error) {
    console.error("Error fetching lab:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/admin/labs", async (req, res) => {
  const { name, owner, portals, nodes } = req.body

  if (!name) {
    return res.status(400).json({ error: "Lab name is required" })
  }

  try {
    await sql`BEGIN`

    // Insert lab
    const labResult = await sql`
      INSERT INTO "labs" ("name", "owner") 
      VALUES (${name}, ${owner || ""})
      RETURNING "id"
    `

    const labId = labResult.rows[0].id

    // Insert portals
    if (portals && portals.length > 0) {
      for (const portal of portals) {
        await sql`
          INSERT INTO "lab_portals" ("lab_id", "name", "url", "username", "password")
          VALUES (${labId}, ${portal.name}, ${portal.url}, ${portal.username || ""}, ${portal.password || ""})
        `
      }
    }

    // Insert nodes
    if (nodes && nodes.length > 0) {
      for (const node of nodes) {
        await sql`
          INSERT INTO "lab_nodes" ("lab_id", "type", "name", "ip_address", "username", "password")
          VALUES (${labId}, ${node.type}, ${node.name}, ${node.ip_address || ""}, ${node.username || ""}, ${node.password || ""})
        `
      }
    }

    await sql`COMMIT`

    return res.status(201).json({ message: "Lab created successfully", id: labId })
  } catch (error) {
    await sql`ROLLBACK`
    console.error("Error creating lab:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.put("/api/admin/labs/:id", async (req, res) => {
  const { id } = req.params
  const { name, owner, portals, nodes } = req.body

  if (!name) {
    return res.status(400).json({ error: "Lab name is required" })
  }

  try {
    await sql`BEGIN`

    // Update lab
    await sql`
      UPDATE "labs" 
      SET "name" = ${name}, "owner" = ${owner || ""}
      WHERE "id" = ${id}
    `

    // Delete existing portals and nodes
    await sql`DELETE FROM "lab_portals" WHERE "lab_id" = ${id}`
    await sql`DELETE FROM "lab_nodes" WHERE "lab_id" = ${id}`

    // Insert new portals
    if (portals && portals.length > 0) {
      for (const portal of portals) {
        await sql`
          INSERT INTO "lab_portals" ("lab_id", "name", "url", "username", "password")
          VALUES (${id}, ${portal.name}, ${portal.url}, ${portal.username || ""}, ${portal.password || ""})
        `
      }
    }

    // Insert new nodes
    if (nodes && nodes.length > 0) {
      for (const node of nodes) {
        await sql`
          INSERT INTO "lab_nodes" ("lab_id", "type", "name", "ip_address", "username", "password")
          VALUES (${id}, ${node.type}, ${node.name}, ${node.ip_address || ""}, ${node.username || ""}, ${node.password || ""})
        `
      }
    }

    await sql`COMMIT`

    return res.json({ message: "Lab updated successfully" })
  } catch (error) {
    await sql`ROLLBACK`
    console.error("Error updating lab:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.delete("/api/admin/labs/:id", async (req, res) => {
  const { id } = req.params

  try {
    await sql`DELETE FROM "labs" WHERE "id" = ${id}`
    return res.json({ message: "Lab deleted successfully" })
  } catch (error) {
    console.error("Error deleting lab:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

app.put("/api/admin/labs/reorder", async (req, res) => {
  const { labIds } = req.body

  if (!labIds || !Array.isArray(labIds)) {
    return res.status(400).json({ error: "Lab IDs array is required" })
  }

  try {
    await sql`BEGIN`

    // Update display_order for each lab
    for (let i = 0; i < labIds.length; i++) {
      await sql`
        UPDATE "labs" 
        SET "display_order" = ${i + 1}
        WHERE "id" = ${labIds[i]}
      `
    }

    await sql`COMMIT`

    return res.json({ message: "Lab order updated successfully" })
  } catch (error) {
    await sql`ROLLBACK`
    console.error("Error updating lab order:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// Add this new route after your other admin routes
app.post("/api/admin/create-user", authMiddleware, adminMiddleware, async (req, res) => {
  const { email, password, role } = req.body

  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required" })
  }

  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT * FROM "users" WHERE "email" = ${email}
    `

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" })
    }

    const { hashPassword } = await import("./auth.js")
    const { hash, salt } = await hashPassword(password)

    const result = await sql`
      INSERT INTO "users" ("email", "password_hash", "password_salt", "role")
      VALUES (${email}, ${hash}, ${salt}, ${role})
      RETURNING "id", "email", "role"
    `

    const newUser = result.rows[0]

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    })
  } catch (error) {
    console.error("User creation error:", error)
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

// Fixed file download endpoint
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

    // Instead of redirecting, fetch the file and serve it with proper headers
    const response = await fetch(file.blob_url)
    const fileBuffer = await response.arrayBuffer()

    // Set the correct content type and filename
    res.setHeader("Content-Type", file.mime_type || "application/octet-stream")
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`)

    // Send the file
    res.send(Buffer.from(fileBuffer))
  } catch (error) {
    console.error("Error downloading file:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicPath = path.join(__dirname, "..", "public")

app.use(express.static(publicPath))

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"))
})

// Register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(publicPath, "register.html"))
})

// Apply auth middleware to admin page
app.get("/admin", authMiddleware, adminMiddleware, (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"))
})

// Apply auth middleware to labs page
app.get("/labs", authMiddleware, (req, res) => {
  res.sendFile(path.join(publicPath, "labs.html"))
})

// Apply auth middleware to index page
app.get("/", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
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
