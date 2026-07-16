import { Suspense } from "react";

import type { Metadata } from "next";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create your Writora account. The free plan includes a hosted blog and 5 AI articles a month — no credit card required.",
};

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
