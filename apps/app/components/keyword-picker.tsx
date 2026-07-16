"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SearchIcon, SaveIcon, TrashIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  researchKeywords,
  listSavedKeywords,
  saveKeyword,
  deleteSavedKeyword,
  type KeywordResult,
  type SavedKeyword,
} from "@/lib/keywords";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const fmtNum = (n: number | null) => (n === null ? "—" : n.toLocaleString());
const fmtCpc = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

function diffBadge(d: number | null): { label: string; variant: BadgeVariant } {
  if (d === null) return { label: "—", variant: "outline" };
  if (d < 30) return { label: `${d} Easy`, variant: "default" };
  if (d < 60) return { label: `${d} Medium`, variant: "secondary" };
  return { label: `${d} Hard`, variant: "destructive" };
}

function compBadge(c: number | null): { label: string; variant: BadgeVariant } {
  if (c === null) return { label: "—", variant: "outline" };
  if (c < 0.34) return { label: "Low", variant: "default" };
  if (c < 0.67) return { label: "Medium", variant: "secondary" };
  return { label: "High", variant: "destructive" };
}

interface KeywordPickerProps {
  showUseInArticle?: boolean;
  onUseInArticle?: (target: string, related: string[]) => void;
}

export function KeywordPicker({
  showUseInArticle = false,
  onUseInArticle,
}: KeywordPickerProps) {
  const [seed, setSeed] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedKeyword[]>([]);
  const [target, setTarget] = useState("");
  const [related, setRelated] = useState<Set<string>>(new Set());

  const loadSaved = () => {
    listSavedKeywords()
      .then(setSaved)
      .catch(() => {});
  };

  useEffect(loadSaved, []);

  const handleResearch = async () => {
    if (!seed.trim()) return;
    setError("");
    setLoading(true);
    try {
      setResults(await researchKeywords(seed.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keyword research failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (kw: KeywordResult) => {
    try {
      await saveKeyword({
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
        competition: kw.competition,
        cpc: kw.cpc,
        seed: kw.seed,
      });
      toast.success(`Saved "${kw.keyword}"`);
      loadSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save keyword");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedKeyword(id);
      loadSaved();
    } catch {
      toast.error("Failed to delete keyword");
    }
  };

  const toggleRelated = (keyword: string, checked: boolean) => {
    setRelated((prev) => {
      const next = new Set(prev);
      if (checked) next.add(keyword);
      else next.delete(keyword);
      return next;
    });
  };

  const chooseTarget = (keyword: string) => {
    setTarget(keyword);
    setRelated((prev) => {
      const next = new Set(prev);
      next.delete(keyword);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleResearch();
            }}
            placeholder="Seed keyword, e.g. vegetable gardening"
            className="pl-9"
          />
        </div>
        <Button onClick={handleResearch} disabled={loading || !seed.trim()}>
          {loading ? <Spinner className="mr-2" /> : null}
          {loading ? "Researching…" : "Research"}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {showUseInArticle && (target || related.size > 0) && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <span className="text-sm font-medium">Target:</span>
          {target ? (
            <Badge>{target}</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">none</span>
          )}
          {related.size > 0 && (
            <>
              <span className="text-sm font-medium">Related:</span>
              {[...related].map((k) => (
                <Badge key={k} variant="secondary">
                  {k}
                </Badge>
              ))}
            </>
          )}
          <Button
            size="sm"
            className="ml-auto"
            disabled={!target}
            onClick={() => onUseInArticle?.(target, [...related])}
          >
            <SparklesIcon className="mr-2 size-4" />
            Use in article
          </Button>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead>CPC</TableHead>
                {showUseInArticle && <TableHead>Target</TableHead>}
                {showUseInArticle && <TableHead>Related</TableHead>}
                <TableHead className="text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((kw) => {
                const diff = diffBadge(kw.difficulty);
                const comp = compBadge(kw.competition);
                return (
                  <TableRow key={kw.keyword}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>{fmtNum(kw.searchVolume)}</TableCell>
                    <TableCell>
                      <Badge variant={diff.variant}>{diff.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={comp.variant}>{comp.label}</Badge>
                    </TableCell>
                    <TableCell>{fmtCpc(kw.cpc)}</TableCell>
                    {showUseInArticle && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant={
                            target === kw.keyword ? "default" : "outline"
                          }
                          onClick={() => chooseTarget(kw.keyword)}
                        >
                          {target === kw.keyword ? "Target" : "Set"}
                        </Button>
                      </TableCell>
                    )}
                    {showUseInArticle && (
                      <TableCell>
                        <Checkbox
                          checked={related.has(kw.keyword)}
                          disabled={target === kw.keyword}
                          onCheckedChange={(c) =>
                            toggleRelated(kw.keyword, c === true)
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Save keyword"
                        onClick={() => handleSave(kw)}
                      >
                        <SaveIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Saved keywords</h3>
        {saved.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No saved keywords yet. Research a seed above and save the ones you
            like.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {saved.map((kw) => (
              <Badge
                key={kw.id}
                variant="secondary"
                className="gap-1 py-1.5 pr-1.5 pl-3 text-sm"
              >
                {showUseInArticle ? (
                  <button
                    className="hover:underline"
                    onClick={() => chooseTarget(kw.keyword)}
                    title="Set as target keyword"
                  >
                    {kw.keyword}
                  </button>
                ) : (
                  kw.keyword
                )}
                {kw.searchVolume !== null && (
                  <span className="text-muted-foreground">
                    · {kw.searchVolume.toLocaleString()}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(kw.id)}
                  className="text-muted-foreground hover:text-foreground ml-1 rounded-sm p-0.5 transition-colors"
                  title="Remove"
                >
                  <TrashIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
