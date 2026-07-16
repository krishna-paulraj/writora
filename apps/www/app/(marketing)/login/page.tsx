import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your Writora account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
