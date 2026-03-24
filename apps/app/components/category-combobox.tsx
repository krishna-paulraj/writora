"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CategoryCombobox({
  value,
  onChange,
  className,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/categories`, {
        credentials: "include",
      });
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!search.trim()) return;
    try {
      const res = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: search.trim() }),
      });
      if (res.ok) {
        const cat = await res.json();
        setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(cat.name);
        setSearch("");
        setOpen(false);
        toast.success(`Category "${cat.name}" created`);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to create category");
      }
    } catch {
      toast.error("Failed to create category");
    }
  };

  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === search.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {value || "Select category..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search categories..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {categories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value.toLowerCase() === cat.name.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {search.trim() && !exactMatch && (
              <>
                <CommandSeparator />
                <CommandGroup forceMount>
                  <CommandItem onSelect={handleCreate} forceMount>
                    <PlusIcon className="mr-2 size-4" />
                    Create &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
            {!search.trim() && categories.length === 0 && (
              <div className="py-3 text-center text-sm text-muted-foreground">
                Type to create a category.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
