"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  EyeIcon,
  Loader2Icon,
  SaveIcon,
  SettingsIcon,
  ChevronDownIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface UserProfile {
  username: string;
}

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
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
    Promise.all([
      fetch(`${API_URL}/blogs/${id}`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
      fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
    ])
      .then(([blog, profile]) => {
        setForm({
          title: blog.title || "",
          slug: blog.slug || "",
          description: blog.description || "",
          content: blog.content || "",
          imageUrl: blog.imageUrl || "",
          category: blog.category || "",
          readTime: blog.readTime || 5,
          featured: blog.featured || false,
          published: blog.published || false,
        });
        setUser({ username: profile.username });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast.success("Blog saved successfully");
      } else {
        toast.error("Failed to save blog");
      }
    } catch {
      toast.error("Failed to save blog");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, published: true }),
      });
      if (res.ok) {
        setForm((prev) => ({ ...prev, published: true }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast.success("Blog published!");
      } else {
        toast.error("Failed to publish");
      }
    } catch {
      toast.error("Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = user ? `${WWW_URL}/${user.username}/${form.slug}` : null;

  if (loading) {
    return (
      <>
        <SiteHeader title="Edit Blog Post" />
        <div className="flex items-center justify-center py-24">
          <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="Edit Blog Post" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full flex-col gap-4 p-4 lg:p-6">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/blogs")}
              >
                Back to Blogs
              </Button>
              {form.published ? (
                <Badge variant="default" className="text-xs">
                  Published
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Draft
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {previewUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <EyeIcon className="mr-1.5 size-3.5" />
                    Preview
                  </a>
                </Button>
              )}
              <div className="flex items-center">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-r-none"
                >
                  <SaveIcon className="mr-1.5 size-3.5" />
                  {saving ? "Saving..." : saved ? "Saved!" : "Save"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      disabled={saving}
                      className="rounded-l-none border-l border-l-primary-foreground/20 px-2"
                    >
                      <ChevronDownIcon className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setForm((prev) => ({ ...prev, published: false }));
                        setTimeout(() => handleSave(), 0);
                      }}
                    >
                      Save as Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handlePublish}
                      disabled={!form.title || !form.content}
                    >
                      Publish
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Title */}
          <Input
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="Blog title"
            className="border-none text-2xl font-semibold shadow-none focus-visible:ring-0 px-0 h-auto py-2"
          />

          {/* Settings bar */}
          <div className="space-y-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <SettingsIcon className="size-3.5" />
              Post settings
            </div>
            <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Read Time (min)</Label>
                  <Input
                    type="number"
                    value={form.readTime}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        readTime: parseInt(e.target.value) || 5,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-end gap-4 pb-0.5">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="featured"
                      checked={form.featured}
                      onCheckedChange={(featured) =>
                        setForm((prev) => ({ ...prev, featured }))
                      }
                    />
                    <Label htmlFor="featured" className="text-xs">
                      Featured
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="published"
                      checked={form.published}
                      onCheckedChange={(published) =>
                        setForm((prev) => ({ ...prev, published }))
                      }
                    />
                    <Label htmlFor="published" className="text-xs">
                      Published
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description"
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cover Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.imageUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          imageUrl: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
                  {form.imageUrl && (
                    <img
                      src={form.imageUrl}
                      alt="Cover preview"
                      className="mt-1.5 h-20 w-full rounded object-cover"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Editor - full width */}
        <div
          data-color-mode="auto"
          className="mx-auto min-h-0 flex-1 p-4 lg:p-6 mb-20"
        >
          <MDEditor
            value={form.content}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, content: val || "" }))
            }
            height={700}
            preview="live"
          />
        </div>
      </div>
    </>
  );
}
