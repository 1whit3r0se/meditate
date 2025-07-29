import { sql } from "@vercel/postgres"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

export async function initializeAuthTables() {
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
        "email" TEXT NOT NULL UNIQUE,
        "password_hash" TEXT NOT NULL,
        "password_salt" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log("Created users table")
  }
}

export async function hashPassword(password) {
  const saltRounds = 10
  const salt = await bcrypt.genSalt(saltRounds)
  const hash = await bcrypt.hash(password, salt)
  return { hash, salt }
}

export async function verifyPassword(password, hash, salt) {
  return await bcrypt.compare(password, hash)
}

export function createToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" })
  return token
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded
  } catch (error) {
    return null
  }
}

export function getTokenExpiration(token) {
  try {
    const decoded = jwt.decode(token)
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000) // Convert seconds to milliseconds
    }
    return null
  } catch (error) {
    console.error("Error decoding token:", error)
    return null
  }
}

export const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ error: "Invalid token" })
  }

  req.user = user
  next()
}

export const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next()
  } else {
    return res.status(403).json({ error: "Forbidden" })
  }
}
