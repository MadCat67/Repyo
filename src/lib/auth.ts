import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      companyId: string | null;
    };
  }

  interface User {
    role: Role;
    companyId: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    companyId: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.companyId = user.companyId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id || !token?.role) {
        return session;
      }
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.companyId = (token.companyId as string | null) ?? null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
