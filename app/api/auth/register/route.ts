// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { registerSchema } from "../../../../lib/schemas/auth";
import { query } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 422 }
      );
    }

    const { email, name, password } = parsed.data;

    // 1️⃣ Ensure auth table exists (if not, create it)
    await query(`
      CREATE TABLE IF NOT EXISTS auth (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2️⃣ Check if email already exists
    const existing = await query(
      "SELECT id FROM auth WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // 3️⃣ Hash password
    const password_hash = await hashPassword(password);

    // 4️⃣ Insert new user
    const res = await query(
      `INSERT INTO auth (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email, name || null, password_hash]
    );

    const user = res.rows[0];

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("Register error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
