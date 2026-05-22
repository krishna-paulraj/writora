"use client";

import { useCallback, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  SparklesIcon,
  StopCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type EditAction, type Tone, streamEdit } from "@/lib/ai";

const TONES: { id: Tone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "friendly", label: "Friendly" },
  { id: "witty", label: "Witty" },
  { id: "confident", label: "Confident" },
];

interface Props {
  editor: Editor;
}

export function TiptapAiMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runAi = useCallback(
    async (action: EditAction, tone?: Tone) => {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      const selectedText = editor.state.doc.textBetween(from, to, "\n");
      if (!selectedText.trim()) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setOpen(false);

      // Replace the selection with an empty insertion point that grows as the
      // model streams. We track an "anchor" position that's just before the
      // newly-inserted text so we can replace it incrementally.
      editor.chain().focus().deleteRange({ from, to }).run();
      let cursor = from;
      let inserted = "";

      try {
        await streamEdit({
          action,
          text: selectedText,
          tone,
          signal: controller.signal,
          onDelta: (delta) => {
            inserted += delta;
            // Insert at the current cursor, then advance
            editor
              .chain()
              .insertContentAt(cursor, delta, { updateSelection: false })
              .run();
            cursor += delta.length;
          },
        });
      } catch (err) {
        if (controller.signal.aborted) {
          toast.info("AI request cancelled");
        } else {
          toast.error(err instanceof Error ? err.message : "AI failed");
          // Restore the original text on failure
          if (inserted.length === 0) {
            editor
              .chain()
              .insertContentAt(from, selectedText, { updateSelection: false })
              .run();
          }
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [editor],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: e, from, to }) => {
        if (streaming) return true;
        if (from === to) return false;
        // Don't show inside code blocks or images
        if (e.isActive("codeBlock") || e.isActive("image")) return false;
        return true;
      }}
      className="z-50"
    >
      <div className="bg-popover text-popover-foreground flex items-center gap-1 rounded-md border p-1 shadow-md">
        {streaming ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={cancel}
            className="h-7 gap-1.5 text-xs"
          >
            <StopCircleIcon className="size-3.5" />
            Stop
          </Button>
        ) : (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 gap-1.5 text-xs",
                  "text-primary hover:text-primary",
                )}
              >
                <SparklesIcon className="size-3.5" />
                Ask AI
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => runAi("improve")}>
                <SparklesIcon className="mr-2 size-3.5" />
                Improve writing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAi("fix")}>
                <CheckIcon className="mr-2 size-3.5" />
                Fix grammar & spelling
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => runAi("shorten")}>
                Make shorter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runAi("lengthen")}>
                Make longer
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change tone</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TONES.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => runAi("tone", t.id)}
                    >
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => runAi("continue")}>
                Continue writing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {streaming && (
          <Loader2Icon className="text-primary mr-1 size-3.5 animate-spin" />
        )}
      </div>
    </BubbleMenu>
  );
}
