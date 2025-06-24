import { sql } from "@vercel/postgres"
import crypto from "crypto"
import jwt from "jsonwebtoken"

// Hash password with SHA-256 and salt
export async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.createHash("sha256")
  hash.update(password + salt)
  return { hash: hash.digest("hex"), salt }
}

// Verify password
export async function verifyPassword(password, hash, salt) {
  const { hash: newHash } = await hashPassword(password, salt)
  return newHash === hash
}

// Create JWT token
export function createToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  }

  return jwt.sign(payload, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "1d" })
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
  } catch (error) {
    return null
  }
}

// Get token expiration time
export function getTokenExpiration(token) {
  try {
    const decoded = jwt.decode(token)
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000)
    }
    return null
  } catch (error) {
    return null
  }
}

// Initialize auth tables
export async function initializeAuthTables() {
  try {
    // Check if users table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `

    if (!tableExists.rows[0].exists) {
      await sql`
        CREATE TABLE "users" (
          "id" SERIAL PRIMARY KEY,
          "email" TEXT UNIQUE NOT NULL,
          "password_hash" TEXT NOT NULL,
          "password_salt" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'user',
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log("Created users table")

      // Create default admin user
      const { hash, salt } = await hashPassword("k985d2mm123")
      await sql`
        INSERT INTO "users" ("email", "password_hash", "password_salt", "role")
        VALUES ('kris@m', ${hash}, ${salt}, 'admin')
      `
      console.log("Created admin user: kris@e / k985d2mm123")
    }

    return true
  } catch (error) {
    console.error("Error initializing auth tables:", error)
    return false
  }
}

// Auth middleware
export function authMiddleware(req, res, next) {
  // Get token from cookies or Authorization header
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

  if (!token) {
    return res.redirect("/login")
  }

  const user = verifyToken(token)
  if (!user) {
    return res.redirect("/login")
  }

  // Add user to request object
  req.user = user
  next()
}

// Admin middleware
export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("You are not authorized to enter admin page.")
  }

  next()
}
