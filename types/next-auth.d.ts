declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      fullName: string;
      role: string;
      isActive: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }
}

export {};

