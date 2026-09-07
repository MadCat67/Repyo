import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import type { Role, UserAccountState } from "@prisma/client";
import { isAccountActive } from "@/lib/security/authorization";
import { isKillSwitchActive } from "@/lib/security/kill-switch";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      companyId: string | null;
      accountState: UserAccountState;
      adminPermissions: string[];
    };
  }

  interface User {
    role: Role;
    companyId: string | null;
    sessionVersion: number;
    accountState: UserAccountState;
    adminPermissions: string[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    companyId: string | null;
    sessionVersion: number;
    accountState: UserAccountState;
    adminPermissions: string[];
    error?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();

        const globalKill = await isKillSwitchActive("GLOBAL");
        if (globalKill.blocked) return null;

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !isAccountActive(user.accountState)) return null;

        const userKill = await isKillSwitchActive("USER", user.id);
        if (userKill.blocked) return null;

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
          sessionVersion: user.sessionVersion,
          accountState: user.accountState,
          adminPermissions: user.adminPermissions,
        };
      },
    }),
  ],
});
