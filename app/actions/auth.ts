"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

function value(
  formData: FormData,
  key: string,
) {
  const raw = formData.get(key);

  return typeof raw === "string"
    ? raw.trim()
    : "";
}

export async function parentLogin(
  formData: FormData,
) {
  try {
    await signIn("credentials", {
      email: value(
        formData,
        "email",
      ),
      password: value(
        formData,
        "password",
      ),
      portal: "parent",
      redirectTo: "/parent",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        "/?error=invalid_credentials",
      );
    }

    throw error;
  }
}

export async function staffLogin(
  formData: FormData,
) {
  try {
    await signIn("credentials", {
      email: value(
        formData,
        "email",
      ),
      password: value(
        formData,
        "password",
      ),
      portal: "staff",
      redirectTo:
        "/staff/redirect",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        "/staff/login?error=invalid_credentials",
      );
    }

    throw error;
  }
}

export async function logout() {
  await signOut({
    redirectTo: "/",
  });
}