// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { query } from "../../../../lib/db";
import { verifyPassword } from "../../../../lib/auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const { email, password } = credentials;

        const res = await query(
          "SELECT id, email, name, password_hash FROM auth WHERE email = $1 LIMIT 1",
          [email]
        );

        if (res.rows.length === 0) return null;

        const user = res.rows[0];

        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name || undefined,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = (user as any).id;
      return token;
    },
    async session({ session, token }) {
      (session as any).user.id = token.id;
      return session;
    },
  },

  pages: {
    signIn: "/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ✅ REQUIRED in App Router (fix)
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
