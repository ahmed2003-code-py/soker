import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      name: string;
      username: string;
      role: Role;
      mustChangePassword: boolean;
    };
  }
  interface User {
    id: string;
    username: string;
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    username: string;
    role: Role;
    mustChangePassword: boolean;
  }
}
