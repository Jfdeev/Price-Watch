import { prisma } from "./../prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_this_to_a_secure_value";

export async function registerUser(data: { name?: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("Email already in use");
  }

  const usersCount = await prisma.user.count();
  const role = usersCount === 0 ? "ADMIN" : "USER";

  const hashed = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      role: role as any
    }
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  const isFirstAdmin = usersCount === 0;

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    isFirstAdmin
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid credentials");

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
