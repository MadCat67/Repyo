import type { NextAuthConfig } from "next-auth";
import type { Role, UserAccountState } from "@prisma/client";
import { db } from "@/lib/db";
import { isAccountActive } from "@/lib/security/authorization";

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
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        token.accountState = (user as { accountState?: UserAccountState }).accountState ?? "REGISTERED";
        token.adminPermissions = (user as { adminPermissions?: string[] }).adminPermissions ?? [];
      }

      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            sessionVersion: true,
            accountState: true,
            role: true,
            companyId: true,
            adminPermissions: true,
          },
        });

        if (!dbUser || !isAccountActive(dbUser.accountState)) {
          token.error = "SessionRevoked";
          return token;
        }

        if (token.sessionVersion !== dbUser.sessionVersion) {
          token.error = "SessionRevoked";
          return token;
        }

        token.role = dbUser.role;
        token.companyId = dbUser.companyId;
        token.accountState = dbUser.accountState;
        token.adminPermissions = dbUser.adminPermissions;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error === "SessionRevoked") {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      if (!token?.id || !token?.role) {
        return session;
      }
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.companyId = (token.companyId as string | null) ?? null;
      session.user.accountState = token.accountState as UserAccountState;
      session.user.adminPermissions = (token.adminPermissions as string[]) ?? [];
      return session;
    },
  },
} satisfies NextAuthConfig;
