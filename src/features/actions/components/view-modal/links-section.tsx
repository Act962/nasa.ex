"use client";

import { useState } from "react";
import { Link2Icon, ExternalLinkIcon, XIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LinkItem {
  title: string;
  url: string;
}

interface Props {
  links: LinkItem[];
  onUpdate: (links: LinkItem[]) => void;
  disabled?: boolean;
}

export function LinksSection({ links = [], onUpdate, disabled }: Props) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const handleAdd = () => {
    if (!url.trim()) return;
    onUpdate([...links, { title: title.trim() || url.trim(), url: url.trim() }]);
    setUrl("");
    setTitle("");
    setAdding(false);
  };

  const handleRemove = (index: number) => {
    onUpdate(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Link2Icon className="size-3.5" />Links
        </span>
        {!adding && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setAdding(true)} disabled={disabled}>
            <PlusIcon className="size-3 mr-1" />Adicionar
          </Button>
        )}
      </div>

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-background text-sm group">
              <Link2Icon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-xs">{link.title}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost" className="size-5">
                    <ExternalLinkIcon className="size-3" />
                  </Button>
                </a>
                {!disabled && (
                  <Button size="icon" variant="ghost" className="size-5 text-destructive" onClick={() => handleRemove(i)}>
                    <XIcon className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="border rounded-md p-3 bg-muted/40 space-y-2">
          <Input
            placeholder="URL (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!url.trim()}>
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setUrl(""); setTitle(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
