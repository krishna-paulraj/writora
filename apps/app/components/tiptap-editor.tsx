"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  MinusIcon,
  ImageIcon,
  LinkIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  Undo2Icon,
  Redo2Icon,
  CodeXmlIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { TiptapAiMenu } from "./tiptap-ai-menu";

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50",
            active && "bg-accent text-foreground",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

function EditorToolbar({
  editor,
  onPickImage,
}: {
  editor: Editor;
  onPickImage: () => void;
}) {
  // Force re-render on selection/content changes so active states update
  const [, setForceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => setForceUpdate((n) => n + 1);
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  // addImage is provided by the parent so drop/paste and the toolbar share one
  // upload-and-insert pipeline.

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 backdrop-blur">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2Icon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2Icon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1Icon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2Icon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3Icon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <BoldIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <ItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <StrikethroughIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline Code"
      >
        <CodeIcon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <ListIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Ordered List"
      >
        <ListOrderedIcon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <QuoteIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <CodeXmlIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <MinusIcon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align Left"
      >
        <AlignLeftIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align Center"
      >
        <AlignCenterIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align Right"
      >
        <AlignRightIcon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Media */}
      <ToolbarButton
        onClick={addLink}
        active={editor.isActive("link")}
        title="Link"
      >
        <LinkIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onPickImage} title="Image (or drop / paste)">
        <ImageIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  // Indirection: editorProps handlers are captured at useEditor() time before
  // `editor` exists. The ref is set in an effect below once editor is ready.
  const handleImageFileRef: RefObject<(file: File) => void> = useRef(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full mx-auto",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[500px] px-0 py-4",
      },
      handleDrop(_view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        for (const file of files) handleImageFileRef.current(file);
        return true;
      },
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((i) => i.type.startsWith("image/"));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        handleImageFileRef.current(file);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Bind the actual upload-and-insert logic to the ref once editor is ready
  useEffect(() => {
    if (!editor) {
      handleImageFileRef.current = () => {};
      return;
    }
    handleImageFileRef.current = async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only images are supported");
        return;
      }
      const tId = toast.loading("Uploading image…");
      try {
        const url = await uploadImage(file);
        editor.chain().focus().setImage({ src: url }).run();
        toast.success("Image inserted", { id: tId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed", {
          id: tId,
        });
      }
    };
  }, [editor]);

  const pickImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleImageFileRef.current(file);
    };
    input.click();
  }, []);

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border">
      <EditorToolbar editor={editor} onPickImage={pickImage} />
      <TiptapAiMenu editor={editor} />
      <div className="px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
