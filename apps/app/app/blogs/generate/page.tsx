"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SparklesIcon, SearchIcon, ChevronDownIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CategoryCombobox } from "@/components/category-combobox";
import { KeywordPicker } from "@/components/keyword-picker";
import {
  generateArticle,
  getArticleJob,
  type ArticleJobStatus,
  type GenerateArticleInput,
} from "@/lib/ai";

const POLL_MS = 2500;

const STAGE_LABEL: Record<string, string> = {
  pending: "Queued…",
  running: "Writing your article…",
};

export default function GenerateArticlePage() {
  const router = useRouter();
  const [form, setForm] = useState<GenerateArticleInput>({
    topic: "",
    targetKeyword: "",
    tone: "professional",
    length: "medium",
    audience: "",
    category: "",
  });
  const [job, setJob] = useState<ArticleJobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Clear the interval if the user navigates away mid-generation.
  useEffect(() => stopPolling, []);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const { jobId } = await generateArticle({
        ...form,
        targetKeyword: form.targetKeyword || undefined,
        relatedKeywords: form.relatedKeywords?.length
          ? form.relatedKeywords
          : undefined,
        audience: form.audience || undefined,
        category: form.category || undefined,
      });
      setJob({
        id: jobId,
        status: "pending",
        progress: 0,
        topic: form.topic,
        blogId: null,
        error: null,
        createdAt: new Date().toISOString(),
      });
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const next = await getArticleJob(jobId);
          setJob(next);
          if (next.status === "done" && next.blogId) {
            stopPolling();
            toast.success("Article drafted!");
            router.push(`/blogs/${next.blogId}/edit`);
          } else if (next.status === "failed") {
            stopPolling();
            setError(next.error || "Generation failed");
          }
        } catch {
          // Transient fetch error — keep polling.
        }
      }, POLL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const generating =
    job !== null && (job.status === "pending" || job.status === "running");

  return (
    <>
      <SiteHeader title="Generate Article" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 pt-12 lg:p-6 lg:pt-16">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">
              Generate an article with AI
            </h2>
            <p className="text-muted-foreground text-sm">
              Describe your topic and we&apos;ll draft a full, SEO-structured
              post. You can edit everything afterward.
            </p>
          </div>

          {generating ? (
            <div className="space-y-4 rounded-lg border p-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Spinner />
                {STAGE_LABEL[job.status] ?? "Working…"}
              </div>
              <Progress value={job.progress} />
              <p className="text-muted-foreground text-xs">
                Generating &quot;{job.topic}&quot;. This usually takes under a
                minute — you&apos;ll be taken to the editor when it&apos;s
                ready.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic or working title</Label>
                <Input
                  id="topic"
                  value={form.topic}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, topic: e.target.value }))
                  }
                  placeholder="How to start a vegetable garden"
                  autoFocus
                />
              </div>

              <Collapsible className="rounded-lg border p-3">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-between px-1"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <SearchIcon className="size-4" />
                      Find keywords with DataForSEO
                    </span>
                    <ChevronDownIcon className="size-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <KeywordPicker
                    showUseInArticle
                    onUseInArticle={(target, related) => {
                      setForm((p) => ({
                        ...p,
                        targetKeyword: target,
                        relatedKeywords: related,
                      }));
                      toast.success("Keywords applied to this article");
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <Label htmlFor="keyword">
                  Target keyword{" "}
                  <span className="text-muted-foreground">(optional, SEO)</span>
                </Label>
                <Input
                  id="keyword"
                  value={form.targetKeyword ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, targetKeyword: e.target.value }))
                  }
                  placeholder="beginner vegetable gardening"
                />
                {form.relatedKeywords && form.relatedKeywords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-muted-foreground text-xs">
                      Related:
                    </span>
                    {form.relatedKeywords.map((k) => (
                      <Badge key={k} variant="secondary">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tone">Tone</Label>
                  <NativeSelect
                    id="tone"
                    className="w-full"
                    value={form.tone}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tone: e.target.value as GenerateArticleInput["tone"],
                      }))
                    }
                  >
                    <NativeSelectOption value="professional">
                      Professional
                    </NativeSelectOption>
                    <NativeSelectOption value="casual">
                      Casual
                    </NativeSelectOption>
                    <NativeSelectOption value="friendly">
                      Friendly
                    </NativeSelectOption>
                    <NativeSelectOption value="witty">Witty</NativeSelectOption>
                    <NativeSelectOption value="confident">
                      Confident
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="length">Length</Label>
                  <NativeSelect
                    id="length"
                    className="w-full"
                    value={form.length}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        length: e.target
                          .value as GenerateArticleInput["length"],
                      }))
                    }
                  >
                    <NativeSelectOption value="short">
                      Short (~800 words)
                    </NativeSelectOption>
                    <NativeSelectOption value="medium">
                      Medium (~1500 words)
                    </NativeSelectOption>
                    <NativeSelectOption value="long">
                      Long (~2800 words)
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">
                  Audience{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="audience"
                  value={form.audience}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, audience: e.target.value }))
                  }
                  placeholder="Beginners with small backyards"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <CategoryCombobox
                  value={form.category ?? ""}
                  onChange={(category) => setForm((p) => ({ ...p, category }))}
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

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
                  disabled={submitting || !form.topic.trim()}
                >
                  <SparklesIcon className="mr-2 size-4" />
                  {submitting ? "Starting…" : "Generate"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
