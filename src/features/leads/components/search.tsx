"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { CircleX, Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

export default function Search() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";
  const hasQuery = !!searchParams?.has("q");

  const handleSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      if (query.trim()) {
        router.push(`/blog?q=${encodeURIComponent(query)}`);
      }
    },
    [query, router]
  );

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;

    router.push(`/tracking?q=${encodeURIComponent(newQuery)}`, {
      scroll: false,
    });
  };

  const resetSearch = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    router.push("/tracking", {
      scroll: false,
    });
  };

  useEffect(() => {
    if (hasQuery) {
      inputRef.current?.focus();
    }
  }, [hasQuery]);

  return (
    <form onSubmit={handleSearch} className="w-full">
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          onChange={handleQueryChange}
          placeholder="Pesquisar..."
        />
        <InputGroupAddon>
          <SearchIcon className="size-4" />
        </InputGroupAddon>
        {query && (
          <InputGroupAddon align="inline-end" onClick={resetSearch}>
            <CircleX className="size-4 cursor-pointer" />
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  );
}
