"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const getString = (value: FormDataEntryValue | null): string => {
  return typeof value === "string" ? value.trim() : "";
};

export const signInAction = async (formData: FormData) => {
  const email = getString(formData.get("email"));
  const password = getString(formData.get("password"));

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
};

export const signUpAction = async (formData: FormData) => {
  const email = getString(formData.get("email"));
  const password = getString(formData.get("password"));

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account");
};
