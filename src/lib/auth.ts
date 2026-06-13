import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const خيارات_المصادقة: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 ساعة
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "اسم المستخدم", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(creds) {
        const username = creds?.username?.trim();
        const password = creds?.password ?? "";
        if (!username || !password) return null;

        const مستخدم = await prisma.user.findUnique({ where: { username } });
        if (!مستخدم || !مستخدم.active) return null;

        const مطابق = await bcrypt.compare(password, مستخدم.passwordHash);
        if (!مطابق) return null;

        return {
          id: String(مستخدم.id),
          name: مستخدم.name,
          username: مستخدم.username,
          role: مستخدم.role,
          mustChangePassword: مستخدم.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id);
        token.role = (user as { role: Role }).role;
        token.name = user.name ?? "";
        token.username = (user as { username: string }).username;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as number;
        session.user.role = token.role as Role;
        session.user.name = token.name as string;
        session.user.username = token.username as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
};
