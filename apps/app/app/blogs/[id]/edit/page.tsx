"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { marked } from "marked";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  ImageIcon,
  Loader2Icon,
  PanelRightIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryCombobox } from "@/components/category-combobox";
import { TiptapEditor } from "@/components/tiptap-editor";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateImage, uploadImage } from "@/lib/upload";
import { suggestTitles, summarize } from "@/lib/ai";
import { scoreSeo, type SeoScoreResult } from "@/lib/seo";
import { Progress } from "@/components/ui/progress";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WWW_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface UserProfile {
  username: string;
}

function ensureHtml(content: string): string {
  if (!content) return "";
  if (content.trim().startsWith("<")) return content;
  return marked.parse(content, { async: false }) as string;
}

function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="hover:text-foreground/80 flex w-full items-center justify-between py-3 text-sm font-medium transition-colors">
        {title}
        <ChevronDownIcon className="size-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface BlogForm {
  title: string;
  slug: string;
  description: string;
  content: string;
  imageUrl: string;
  category: string;
  targetKeyword: string;
  readTime: number;
  featured: boolean;
  published: boolean;
  scheduledAt: string | null;
}

const EMPTY_FORM: BlogForm = {
  title: "",
  slug: "",
  description: "",
  content: "",
  imageUrl: "",
  category: "",
  targetKeyword: "",
  readTime: 5,
  featured: false,
  published: false,
  scheduledAt: null,
};

function formsEqual(a: BlogForm, b: BlogForm) {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.description === b.description &&
    a.content === b.content &&
    a.imageUrl === b.imageUrl &&
    a.category === b.category &&
    a.targetKeyword === b.targetKeyword &&
    a.featured === b.featured &&
    a.published === b.published &&
    a.scheduledAt === b.scheduledAt
  );
}

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "dirty" | "error"
  >("idle");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [form, setForm] = useState<BlogForm>(EMPTY_FORM);
  const [seo, setSeo] = useState<SeoScoreResult | null>(null);
  const lastSavedRef = useRef<BlogForm | null>(null);
  const inFlightRef = useRef(false);

  const isDirty = useMemo(
    () =>
      lastSavedRef.current ? !formsEqual(form, lastSavedRef.current) : false,
    [form],
  );

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
        const initial: BlogForm = {
          title: blog.title || "",
          slug: blog.slug || "",
          description: blog.description || "",
          content: ensureHtml(blog.content || ""),
          imageUrl: blog.imageUrl || "",
          category: blog.category || "",
          targetKeyword: blog.targetKeyword || "",
          readTime: blog.readTime || 5,
          featured: blog.featured || false,
          published: blog.published || false,
          scheduledAt: blog.scheduledAt || null,
        };
        setForm(initial);
        lastSavedRef.current = initial;
        setUser({ username: profile.username });
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Mark UI as dirty when the form diverges from last saved
  useEffect(() => {
    if (isDirty && saveStatus !== "saving") setSaveStatus("dirty");
  }, [isDirty, saveStatus]);

  const persist = async (
    payload: BlogForm,
    opts: { silent?: boolean; successMessage?: string } = {},
  ): Promise<boolean> => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${API_URL}/blogs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaveStatus("error");
        if (!opts.silent) toast.error("Failed to save");
        return false;
      }
      lastSavedRef.current = payload;
      setSaveStatus("saved");
      if (opts.successMessage) toast.success(opts.successMessage);
      return true;
    } catch {
      setSaveStatus("error");
      if (!opts.silent) toast.error("Failed to save");
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  // Debounced autosave: 1.5s after last edit, if dirty and has a title
  useEffect(() => {
    if (!isDirty || !form.title) return;
    const timer = setTimeout(() => {
      persist(form, { silent: true });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isDirty]);

  // Debounced on-page SEO scoring against the target keyword.
  useEffect(() => {
    if (!form.targetKeyword.trim()) return;
    const timer = setTimeout(() => {
      scoreSeo({
        title: form.title,
        description: form.description,
        contentHtml: form.content,
        targetKeyword: form.targetKeyword,
      })
        .then(setSeo)
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [form.title, form.description, form.content, form.targetKeyword]);

  // Warn on browser-level navigation away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Flush a final save on client-side navigation away
  const formRef = useRef(form);
  const dirtyRef = useRef(isDirty);
  formRef.current = form;
  dirtyRef.current = isDirty;
  useEffect(() => {
    return () => {
      if (dirtyRef.current && formRef.current.title) {
        fetch(`${API_URL}/blogs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formRef.current),
          keepalive: true,
        });
      }
    };
  }, [id]);

  const handleSave = () => persist(form, { successMessage: "Saved" });

  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);

  const handleSuggestTitles = async () => {
    if (!form.content || form.content.trim().length < 30) {
      toast.error("Write some content first");
      return;
    }
    setLoadingTitles(true);
    setTitleOpen(true);
    try {
      const titles = await suggestTitles(form.content);
      setTitleSuggestions(titles);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to suggest titles",
      );
      setTitleOpen(false);
    } finally {
      setLoadingTitles(false);
    }
  };

  const handleSuggestDescription = async () => {
    if (!form.content || form.content.trim().length < 30) {
      toast.error("Write some content first");
      return;
    }
    setGeneratingDesc(true);
    try {
      const summary = await summarize(form.content);
      setForm((prev) => ({ ...prev, description: summary }));
      toast.success("Description generated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate description",
      );
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCoverUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const tId = toast.loading("Uploading cover image…");
      try {
        const url = await uploadImage(file);
        setForm((prev) => ({ ...prev, imageUrl: url }));
        toast.success("Cover image set", { id: tId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", {
          id: tId,
        });
      }
    };
    input.click();
  };

  const handleGenerateCover = async () => {
    if (!form.title.trim()) {
      toast.error("Add a title first");
      return;
    }
    setGeneratingCover(true);
    const tId = toast.loading("Generating featured image…");
    try {
      const url = await generateImage({
        kind: "featured",
        title: form.title,
        description: form.description,
        keyword: form.targetKeyword,
      });
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Featured image generated", { id: tId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", {
        id: tId,
      });
    } finally {
      setGeneratingCover(false);
    }
  };

  const handlePublish = async () => {
    const payload = { ...form, published: true, scheduledAt: null };
    const ok = await persist(payload, { successMessage: "Blog published!" });
    if (ok) setForm(payload);
  };

  const [scheduleOpen, setScheduleOpen] = useState(false);

  const handleSchedule = async (isoString: string) => {
    const payload = {
      ...form,
      scheduledAt: isoString,
      published: false,
    };
    const ok = await persist(payload, {
      successMessage: `Scheduled for ${format(new Date(isoString), "MMM d, h:mm a")}`,
    });
    if (ok) setForm(payload);
  };

  const handleUnschedule = async () => {
    const payload = { ...form, scheduledAt: null };
    const ok = await persist(payload, { successMessage: "Schedule cleared" });
    if (ok) setForm(payload);
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
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => router.push("/blogs")}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-muted-foreground max-w-[200px] truncate text-sm">
                {form.title || "Untitled"}
              </span>
              {form.published ? (
                <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                  Published
                </Badge>
              ) : form.scheduledAt ? (
                <Badge
                  variant="outline"
                  className="border-primary text-primary px-1.5 py-0 text-[10px]"
                >
                  Scheduled ·{" "}
                  {format(new Date(form.scheduledAt), "MMM d, h:mm a")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  Draft
                </Badge>
              )}
              <span className="text-muted-foreground/80 ml-1 text-xs">
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "dirty"
                    ? "Unsaved changes"
                    : saveStatus === "saved"
                      ? "Saved"
                      : saveStatus === "error"
                        ? "Save failed"
                        : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {previewUrl && (
                <Button variant="ghost" size="sm" asChild className="h-8">
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
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", sidebarOpen && "bg-accent")}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <PanelRightIcon className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  className="h-8 rounded-r-none"
                >
                  <SaveIcon className="mr-1.5 size-3.5" />
                  {saveStatus === "saving" ? "Saving..." : "Save"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      disabled={saveStatus === "saving"}
                      className="border-l-primary-foreground/20 h-8 rounded-l-none border-l px-1.5"
                    >
                      <ChevronDownIcon className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const payload = {
                          ...form,
                          published: false,
                          scheduledAt: null,
                        };
                        setForm(payload);
                        persist(payload, { successMessage: "Saved as draft" });
                      }}
                    >
                      Save as Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setScheduleOpen(true)}
                      disabled={!form.title || !form.content}
                    >
                      {form.scheduledAt ? "Reschedule…" : "Schedule…"}
                    </DropdownMenuItem>
                    {form.scheduledAt && (
                      <DropdownMenuItem onClick={handleUnschedule}>
                        Clear schedule
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={handlePublish}
                      disabled={!form.title || !form.content}
                    >
                      Publish now
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex min-h-0 flex-1">
          {/* Editor area */}
          <div className="editor-scroll flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-6 py-8">
              {/* Title + AI suggest */}
              <div className="mb-2 flex items-start gap-2">
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Add title"
                  className="text-foreground placeholder:text-muted-foreground/40 w-full bg-transparent text-4xl font-light tracking-tight focus:outline-none"
                />
                <Popover open={titleOpen} onOpenChange={setTitleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSuggestTitles}
                      disabled={loadingTitles}
                      className="text-primary mt-2 h-8 shrink-0 gap-1.5 text-xs"
                    >
                      <SparklesIcon className="size-3.5" />
                      {loadingTitles ? "Thinking…" : "Suggest"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-2">
                    {loadingTitles ? (
                      <div className="text-muted-foreground p-3 text-sm">
                        Generating suggestions…
                      </div>
                    ) : titleSuggestions.length === 0 ? (
                      <div className="text-muted-foreground p-3 text-sm">
                        No suggestions yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs">
                          Pick one to apply
                        </p>
                        {titleSuggestions.map((t, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, title: t }));
                              setTitleOpen(false);
                            }}
                            className="hover:bg-accent rounded-md px-2 py-1.5 text-left text-sm"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Description + AI generate */}
              <div className="mb-6 flex items-start gap-2">
                <textarea
                  value={form.description}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }
                  }}
                  placeholder="Add a description..."
                  rows={1}
                  className="text-muted-foreground placeholder:text-muted-foreground/40 w-full resize-none overflow-hidden bg-transparent text-base focus:outline-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSuggestDescription}
                  disabled={generatingDesc}
                  className="text-primary h-8 shrink-0 gap-1.5 text-xs"
                >
                  <SparklesIcon className="size-3.5" />
                  {generatingDesc ? "Writing…" : "Generate"}
                </Button>
              </div>

              {/* Content */}
              <Separator className="mb-6" />
              <TiptapEditor
                content={form.content}
                onChange={(content) =>
                  setForm((prev) => ({ ...prev, content }))
                }
              />
            </div>
          </div>

          {/* Settings sidebar */}
          <div
            className={cn(
              "bg-background overflow-y-auto border-l transition-all duration-200",
              sidebarOpen
                ? "w-[320px] min-w-[320px]"
                : "w-0 min-w-0 border-l-0",
            )}
          >
            {sidebarOpen && (
              <div className="p-4">
                {/* Cover image */}
                <div className="mb-4">
                  {form.imageUrl ? (
                    <div className="group relative">
                      <img
                        src={form.imageUrl}
                        alt="Cover"
                        className="h-40 w-full rounded-lg object-cover"
                      />
                      <button
                        onClick={() =>
                          setForm((prev) => ({ ...prev, imageUrl: "" }))
                        }
                        className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleCoverUpload}
                        className="text-muted-foreground hover:border-foreground/20 hover:text-foreground/60 flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <ImageIcon className="size-5" />
                          <span className="text-xs">Upload featured image</span>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateCover}
                        disabled={generatingCover}
                        className="w-full"
                      >
                        {generatingCover ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <SparklesIcon className="size-3.5" />
                        )}
                        {generatingCover ? "Generating…" : "Generate with AI"}
                      </Button>
                      <div className="text-muted-foreground text-center text-xs">
                        or paste a URL
                      </div>
                      <Input
                        value={form.imageUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            imageUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Post details */}
                <SidebarSection title="Post" defaultOpen>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Status
                      </span>
                      {form.published ? (
                        <Badge
                          variant="default"
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              published: false,
                            }))
                          }
                        >
                          Published
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer text-xs"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              published: true,
                            }))
                          }
                        >
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Slug
                      </span>
                      <Input
                        value={form.slug}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            slug: e.target.value,
                          }))
                        }
                        className="h-7 w-[160px] text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Read time
                      </span>
                      <span className="text-foreground text-xs">
                        ~{form.readTime} min · auto
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Featured
                      </span>
                      <Switch
                        checked={form.featured}
                        onCheckedChange={(featured) =>
                          setForm((prev) => ({ ...prev, featured }))
                        }
                      />
                    </div>
                  </div>
                </SidebarSection>

                <Separator />

                {/* Category */}
                <SidebarSection title="Category" defaultOpen>
                  <CategoryCombobox
                    value={form.category}
                    onChange={(category) =>
                      setForm((prev) => ({ ...prev, category }))
                    }
                    className="h-8 text-sm"
                  />
                </SidebarSection>

                <Separator />

                {/* SEO */}
                <SidebarSection title="SEO" defaultOpen>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-sm">
                        Target keyword
                      </span>
                      <Input
                        value={form.targetKeyword}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            targetKeyword: e.target.value,
                          }))
                        }
                        placeholder="e.g. vegetable gardening"
                        className="h-8 text-sm"
                      />
                    </div>
                    {!form.targetKeyword.trim() ? (
                      <p className="text-muted-foreground text-xs">
                        Set a target keyword to see your SEO score.
                      </p>
                    ) : seo ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Score</span>
                          <span
                            className={cn(
                              "font-semibold",
                              seo.score >= 80
                                ? "text-green-600"
                                : seo.score >= 50
                                  ? "text-amber-600"
                                  : "text-destructive",
                            )}
                          >
                            {seo.score}/100
                          </span>
                        </div>
                        <Progress value={seo.score} />
                        <ul className="space-y-1 pt-1">
                          {seo.checks.map((c) => (
                            <li
                              key={c.id}
                              className="flex items-start gap-2 text-xs"
                            >
                              {c.passed ? (
                                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                              ) : (
                                <XIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  c.passed ? "" : "text-muted-foreground",
                                )}
                              >
                                {c.label}
                                {c.detail ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {c.detail}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-muted-foreground text-xs">
                          {seo.wordCount} words · density {seo.keywordDensity}%
                        </p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Loader2Icon className="size-3.5 animate-spin" />
                        Scoring…
                      </div>
                    )}
                  </div>
                </SidebarSection>

                <Separator />

                {/* Excerpt */}
                <SidebarSection title="Excerpt">
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Write an excerpt..."
                    rows={3}
                    className="text-sm"
                  />
                </SidebarSection>

                <Separator />

                {/* Cover Image URL */}
                <SidebarSection title="Cover Image">
                  <Input
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        imageUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="text-sm"
                  />
                </SidebarSection>
              </div>
            )}
          </div>
        </div>
      </div>
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        value={form.scheduledAt}
        onConfirm={handleSchedule}
      />
    </>
  );
}
