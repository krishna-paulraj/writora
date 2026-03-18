"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    content: "",
    imageUrl: "",
    category: "",
    readTime: 5,
    featured: false,
    published: false,
  });

  useEffect(() => {
    fetch(`${API_URL}/blogs/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setForm({
          title: data.title || "",
          slug: data.slug || "",
          description: data.description || "",
          content: data.content || "",
          imageUrl: data.imageUrl || "",
          category: data.category || "",
          readTime: data.readTime || 5,
          featured: data.featured || false,
          published: data.published || false,
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/blogs");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="Edit Blog Post" />
        <div className="text-muted-foreground py-12 text-center">
          Loading...
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="Edit Blog Post" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Blog title"
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
                placeholder="blog-slug"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Brief description of your blog post"
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="e.g. Design, Product"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Cover Image URL</Label>
              <Input
                id="imageUrl"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readTime">Read Time (min)</Label>
              <Input
                id="readTime"
                type="number"
                value={form.readTime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    readTime: parseInt(e.target.value) || 5,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.featured}
                onCheckedChange={(featured) =>
                  setForm((prev) => ({ ...prev, featured }))
                }
              />
              <Label>Featured</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.published}
                onCheckedChange={(published) =>
                  setForm((prev) => ({ ...prev, published }))
                }
              />
              <Label>Published</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content (Markdown)</Label>
            <div data-color-mode="auto">
              <MDEditor
                value={form.content}
                onChange={(val) =>
                  setForm((prev) => ({ ...prev, content: val || "" }))
                }
                height={500}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/blogs")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.title || !form.slug || !form.content}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
