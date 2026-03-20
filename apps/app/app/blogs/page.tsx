"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BlogThemeSelector } from "@/components/blog-theme-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface Blog {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  const fetchBlogs = async () => {
    try {
      const res = await fetch(`${API_URL}/blogs`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBlogs(data);
      }
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setUsername(data.username || ""))
      .catch(() => {});
  }, []);

  const togglePublish = async (blog: Blog) => {
    const res = await fetch(`${API_URL}/blogs/${blog.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ published: !blog.published }),
    });
    if (res.ok) {
      toast.success(blog.published ? "Blog unpublished" : "Blog published");
    } else {
      toast.error("Failed to update blog");
    }
    fetchBlogs();
  };

  const deleteBlog = async (id: string) => {
    const res = await fetch(`${API_URL}/blogs/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      toast.success("Blog deleted");
    } else {
      toast.error("Failed to delete blog");
    }
    fetchBlogs();
  };

  return (
    <>
      <SiteHeader title="Blogs" />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">My Blogs</h2>
              <p className="text-muted-foreground text-sm">
                Create and manage your blog posts
              </p>
            </div>
            <Button onClick={() => router.push("/blogs/new")}>
              <PlusIcon className="mr-2 size-4" />
              New Blog
            </Button>
          </div>

          {loading ? (
            <div className="text-muted-foreground py-12 text-center">
              Loading...
            </div>
          ) : blogs.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p className="text-lg">No blogs yet</p>
              <p className="text-sm">
                Create your first blog post to get started
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map((blog) => (
                    <TableRow key={blog.id}>
                      <TableCell className="font-medium">
                        {blog.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{blog.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={blog.published ? "default" : "outline"}>
                          {blog.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(blog.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePublish(blog)}
                            title={blog.published ? "Unpublish" : "Publish"}
                          >
                            {blog.published ? (
                              <EyeOffIcon className="size-4" />
                            ) : (
                              <EyeIcon className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(`/blogs/${blog.id}/edit`)
                            }
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete blog post?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{blog.title}&quot;. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteBlog(blog.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {username && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Preview"
                            >
                              <a
                                href={`${WWW_URL}/${username}/${blog.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLinkIcon className="size-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Separator className="my-6" />

          <div>
            <h2 className="text-2xl font-semibold">Blog Theme</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Customize the look of your public blog page
            </p>
            <BlogThemeSelector />
          </div>
        </div>
      </div>
    </>
  );
}
