import NextAuth from "next-auth";
import { خيارات_المصادقة } from "@/lib/auth";

const handler = NextAuth(خيارات_المصادقة);

export { handler as GET, handler as POST };
