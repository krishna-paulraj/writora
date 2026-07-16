"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, Loader2Icon, MailWarningIcon } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadImage } from "@/lib/upload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface ProfileForm {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  twitterHandle: string;
  websiteUrl: string;
}

const EMPTY: ProfileForm = {
  name: "",
  username: "",
  bio: "",
  avatarUrl: "",
  twitterHandle: "",
  websiteUrl: "",
};

export default function SettingsPage() {
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [original, setOriginal] = useState<ProfileForm>(EMPTY);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const profile: ProfileForm = {
          name: data.name || "",
          username: data.username || "",
          bio: data.bio || "",
          avatarUrl: data.avatarUrl || "",
          twitterHandle: data.twitterHandle || "",
          websiteUrl: data.websiteUrl || "",
        };
        setForm(profile);
        setOriginal(profile);
        setEmail(data.email || "");
        setEmailVerified(data.emailVerified || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isDirty =
    form.name !== original.name ||
    form.username !== original.username ||
    form.bio !== original.bio ||
    form.avatarUrl !== original.avatarUrl ||
    form.twitterHandle !== original.twitterHandle ||
    form.websiteUrl !== original.websiteUrl;

  const handleAvatarUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      try {
        const url = await uploadImage(file);
        setForm((prev) => ({ ...prev, avatarUrl: url }));
        toast.success("Avatar uploaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadingAvatar(false);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to save");
        return;
      }
      setOriginal(form);
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Verification email sent");
      } else {
        toast.error("Failed to send verification email");
      }
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="Settings" />
        <div className="flex items-center justify-center py-24">
          <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
        </div>
      </>
    );
  }

  const initials = form.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const publicUrl = form.username ? `${WWW_URL}/${form.username}` : null;

  return (
    <>
      <SiteHeader title="Settings" />
      <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
        {/* Email verification banner */}
        {!emailVerified && (
          <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <MailWarningIcon className="size-5 shrink-0 text-amber-700 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium">Verify your email</p>
                  <p className="text-muted-foreground text-xs">
                    We sent a link to {email}. Check your inbox.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resendVerification}
                disabled={resending}
              >
                {resending ? "Sending..." : "Resend email"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              How you show up on your public blog at{" "}
              {publicUrl ? (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {publicUrl}
                </a>
              ) : (
                "your blog"
              )}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                <AvatarImage src={form.avatarUrl} alt={form.name} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? "Uploading..." : "Upload photo"}
                  </Button>
                  {form.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, avatarUrl: "" }))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Square images work best. Auto-resized + optimized.
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">
                    {WWW_URL.replace(/^https?:\/\//, "")}/
                  </span>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, ""),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="A short bio that appears on your blog homepage."
                rows={3}
                maxLength={280}
              />
              <p className="text-muted-foreground text-xs">
                {form.bio.length} / 280
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="twitter">X / Twitter handle</Label>
                <Input
                  id="twitter"
                  value={form.twitterHandle}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      twitterHandle: e.target.value.replace(/^@/, ""),
                    }))
                  }
                  placeholder="yourhandle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.websiteUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))
                  }
                  placeholder="https://yoursite.com"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Custom domain</Label>
              <p className="text-muted-foreground text-sm">
                Custom domains are configured per site on the{" "}
                <Link href="/sites" className="text-foreground underline">
                  Sites
                </Link>{" "}
                page.
              </p>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                {emailVerified && (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-4" />
                    Email verified
                  </span>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving || !isDirty}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Login email and password recovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
            <p className="text-muted-foreground text-xs">
              Email changes aren&apos;t supported yet. Contact support to
              update.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
