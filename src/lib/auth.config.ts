import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
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
} satisfies NextAuthConfig;
