"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategoryCombobox } from "@/components/category-combobox";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NewBlogPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "",
  });

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug === slugify(prev.title) ? slugify(title) : prev.slug,
    }));
  };

  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/blogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          content: "",
          published: false,
        }),
      });
      if (res.ok) {
        const blog = await res.json();
        toast.success("Blog created! Start writing.");
        router.push(`/blogs/${blog.id}/edit`);
      } else {
        const data = await res.json();
        const msg = data.message || "Failed to create blog";
        setError(msg);
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to create blog");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SiteHeader title="Create New Blog" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8 p-4 pt-12 lg:p-6 lg:pt-16">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">Create a new blog post</h2>
            <p className="text-muted-foreground text-sm">
              Give your post a title and slug to get started. You can write the
              content in the next step.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="My awesome blog post"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="my-awesome-blog-post"
              />
              <p className="text-muted-foreground text-xs">
                This will be the URL path for your blog post
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="A brief summary of your post"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <CategoryCombobox
                value={form.category}
                onChange={(category) =>
                  setForm((prev) => ({ ...prev, category }))
                }
              />
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/blogs")}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={saving || !form.title || !form.slug || !form.category}
            >
              {saving ? "Creating..." : "Create & Write"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
