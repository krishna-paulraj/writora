"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Background } from "@/components/background";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
});

type SignupForm = z.infer<typeof signupSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const Signup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>();

  const onSubmit = async (data: SignupForm) => {
    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Registration failed");
        return;
      }

      window.location.href = APP_URL;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Background>
      <section className="py-28 lg:pt-44 lg:pb-32">
        <div className="container">
          <div className="flex flex-col gap-4">
            <Card className="mx-auto w-full max-w-sm">
              <CardHeader className="flex flex-col items-center space-y-0">
                <Image
                  src="/logo.svg"
                  alt="logo"
                  width={94}
                  height={18}
                  className="mb-7 dark:invert"
                />
                <p className="mb-2 text-2xl font-bold">Start your free trial</p>
                <p className="text-muted-foreground">
                  Sign up in less than 2 minutes.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Enter your name"
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...register("password")}
                    />
                    <p className="text-muted-foreground mt-1 text-sm">
                      Must be at least 8 characters.
                    </p>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create an account"}
                  </Button>
                </form>
                <div className="text-muted-foreground mx-auto mt-8 flex justify-center gap-1 text-sm">
                  <p>Already have an account?</p>
                  <Link href="/login" className="text-primary font-medium">
                    Log in
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Background>
  );
};

export default Signup;
