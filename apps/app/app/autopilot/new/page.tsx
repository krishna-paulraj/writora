"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RocketIcon, SearchIcon, ChevronDownIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CategoryCombobox } from "@/components/category-combobox";
import { KeywordPicker } from "@/components/keyword-picker";
import {
  createContentPlan,
  CADENCE_LABELS,
  type ArticleLength,
  type Cadence,
  type Tone,
} from "@/lib/content-plans";

interface PlanForm {
  title: string;
  topic: string;
  targetKeyword: string;
  relatedKeywords: string[];
  tone: Tone;
  length: ArticleLength;
  audience: string;
  category: string;
  cadence: Cadence;
  articleCount: number;
  autoPublish: boolean;
}

export default function NewContentPlanPage() {
  const router = useRouter();
  const [form, setForm] = useState<PlanForm>({
    title: "",
    topic: "",
    targetKeyword: "",
    relatedKeywords: [],
    tone: "professional",
    length: "medium",
    audience: "",
    category: "",
    cadence: "weekly",
    articleCount: 8,
    autoPublish: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const plan = await createContentPlan({
        title: form.title.trim(),
        topic: form.topic.trim(),
        targetKeyword: form.targetKeyword.trim() || undefined,
        relatedKeywords: form.relatedKeywords.length
          ? form.relatedKeywords
          : undefined,
        tone: form.tone,
        length: form.length,
        audience: form.audience.trim() || undefined,
        category: form.category.trim() || undefined,
        cadence: form.cadence,
        articleCount: form.articleCount,
        autoPublish: form.autoPublish,
      });
      toast.success("Content plan created");
      router.push(`/autopilot/${plan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create plan");
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader title="New Autopilot Plan" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 pt-12 lg:p-6 lg:pt-16">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">Create a content plan</h2>
            <p className="text-muted-foreground text-sm">
              We&apos;ll brainstorm a cluster of article ideas around your topic
              and draft them on a schedule. You can edit the queue afterward.
            </p>
          </div>

          {submitting ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border p-8">
              <Spinner />
              <p className="text-sm font-medium">Building your plan…</p>
              <p className="text-muted-foreground text-center text-xs">
                Brainstorming article ideas for &quot;{form.topic}&quot;. This
                takes a few seconds.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Plan name</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Vegetable gardening autopilot"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Pillar topic or theme</Label>
                <Input
                  id="topic"
                  value={form.topic}
                  onChange={(e) => set("topic", e.target.value)}
                  placeholder="Growing vegetables at home for beginners"
                />
                <p className="text-muted-foreground text-xs">
                  The broad subject the article cluster should cover.
                </p>
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
                      Seed with keywords from DataForSEO
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
                      toast.success("Keywords applied to this plan");
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <Label htmlFor="keyword">
                  Seed keyword{" "}
                  <span className="text-muted-foreground">(optional, SEO)</span>
                </Label>
                <Input
                  id="keyword"
                  value={form.targetKeyword}
                  onChange={(e) => set("targetKeyword", e.target.value)}
                  placeholder="beginner vegetable gardening"
                />
                {form.relatedKeywords.length > 0 && (
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
                    onChange={(e) => set("tone", e.target.value as Tone)}
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
                      set("length", e.target.value as ArticleLength)
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cadence">Cadence</Label>
                  <NativeSelect
                    id="cadence"
                    className="w-full"
                    value={form.cadence}
                    onChange={(e) => set("cadence", e.target.value as Cadence)}
                  >
                    {(Object.keys(CADENCE_LABELS) as Cadence[]).map((c) => (
                      <NativeSelectOption key={c} value={c}>
                        {CADENCE_LABELS[c]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="count">Number of articles</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={30}
                    value={form.articleCount}
                    onChange={(e) =>
                      set(
                        "articleCount",
                        Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                  />
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
                  onChange={(e) => set("audience", e.target.value)}
                  placeholder="Beginners with small backyards"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <CategoryCombobox
                  value={form.category}
                  onChange={(category) => set("category", category)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="autopublish">Publish automatically</Label>
                  <p className="text-muted-foreground text-xs">
                    When off, each article lands as a draft to review first.
                  </p>
                </div>
                <Switch
                  id="autopublish"
                  checked={form.autoPublish}
                  onCheckedChange={(v) => set("autoPublish", v)}
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/autopilot")}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || !form.topic.trim()}
                >
                  <RocketIcon className="mr-2 size-4" />
                  Create plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
