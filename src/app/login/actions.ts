"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function login(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const password = formData.get("password") as string;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return { error: "Invalid password" };
  }

  const token = crypto.randomUUID();
  await convex.mutation(api.sessions.create, { token });

  const cookieStore = await cookies();
  cookieStore.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect("/");
}
