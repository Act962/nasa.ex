"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDownIcon, CopyIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { useDebouncedValue } from "@/hooks/use-debounced";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 5;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parsePhone(full: string | null | undefined) {
  const fallback = { country: countries[0], number: "" };
  if (!full) return fallback;
  const trimmed = full.trim();
  const match = trimmed.match(/^(\+\d{1,4})\s?(.*)$/);
  if (!match) return { country: countries[0], number: normalizePhone(trimmed) };
  const ddi = match[1];
  const country = countries.find((c) => c.ddi === ddi) ?? countries[0];
  return { country, number: normalizePhone(match[2]) };
}

export default function Page() {
  const { data: session, isPending, refetch } = authClient.useSession();

  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phone, setPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionName = session?.user?.name ?? "";
  const sessionPhone =
    (session?.user as { phone?: string | null } | undefined)?.phone ?? "";

  useEffect(() => {
    if (!session?.user) return;
    setName(session.user.name ?? "");
    setImage(session.user.image ?? null);
    const parsed = parsePhone(sessionPhone);
    setSelectedCountry(parsed.country);
    setPhone(phoneMask(parsed.number));
    // Depende do id para rodar uma vez por usuário; usar `session.user` (referência)
    // fazia o effect re-disparar a cada refetch pós-mutate e sobrescrever a digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const updateMut = useMutation({
    mutationFn: (input: { name?: string; image?: string; phone?: string }) =>
      orpc.user.updateProfile.call(input),
    onSuccess: async () => {
      await refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao atualizar perfil.");
    },
  });

  // Link de indicação (qualquer usuário autenticado tem direito ao próprio).
  const { data: referralLink, isLoading: isLoadingLink } = useQuery(
    orpc.partner.getMyLink.queryOptions(),
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      updateMut.mutate({ image: base64 });
    } catch {
      toast.error("Erro ao ler imagem.");
    }
  };

  const debouncedName = useDebouncedValue(name, 5000);
  const phoneDigits = normalizePhone(phone);
  const debouncedPhoneDigits = useDebouncedValue(phoneDigits, 500);
  const debouncedDdi = useDebouncedValue(selectedCountry.ddi, 500);

  // Auto-save name
  useEffect(() => {
    if (!session?.user) return;
    const trimmed = debouncedName.trim();
    if (!trimmed) return;
    if (trimmed === sessionName) return;
    updateMut.mutate({ name: trimmed });
  }, [debouncedName, session?.user, sessionName]);

  // Auto-save phone (DDI + digits)
  useEffect(() => {
    if (!session?.user) return;
    const next = debouncedPhoneDigits
      ? `${debouncedDdi} ${debouncedPhoneDigits}`
      : "";
    if (next === (sessionPhone ?? "")) return;
    updateMut.mutate({ phone: next });
  }, [debouncedPhoneDigits, debouncedDdi, session?.user, sessionPhone]);

  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "U";

  const isSaving = updateMut.isPending;

  return (
    <div className="px-4">
      {/* ── Avatar ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Foto de perfil</h2>
          <span className="text-xs text-muted-foreground">
            Clique na foto para trocar a imagem
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "relative w-20 h-20 rounded-full overflow-hidden cursor-pointer ring-2 ring-border group transition-all hover:ring-primary",
              isSaving && "opacity-60 pointer-events-none",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending ? (
              <div className="w-full h-full bg-muted animate-pulse" />
            ) : image ? (
              <Image
                src={image}
                alt={name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-primary/80 to-primary/40 flex items-center justify-center text-primary-foreground text-2xl font-bold select-none">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isSaving ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={handleFileChange}
            disabled={isSaving}
          />
        </div>
      </div>

      <Separator />

      {/* ── Nome ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Nome</h2>
          <span className="text-xs text-muted-foreground">
            Mude o nome exibido na interface
          </span>
        </div>
        <div className="flex items-center gap-2 w-72">
          <Input
            placeholder="Digite seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <Separator />

      {/* ── Telefone ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Telefone</h2>
          <span className="text-xs text-muted-foreground">
            Selecione o país e digite seu telefone
          </span>
        </div>
        <div className="w-72">
          <Label htmlFor="phone" className="sr-only">
            Telefone
          </Label>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton variant="ghost" className="text-xs">
                    <img
                      src={selectedCountry.flag}
                      alt={selectedCountry.country}
                      className="w-5 h-4 rounded-sm"
                    />
                    <span>{selectedCountry.ddi}</span>
                    <ChevronDownIcon className="size-3" />
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="[--radius:0.95rem] max-h-60 overflow-y-auto"
                >
                  <DropdownMenuGroup>
                    {countries.map((country) => (
                      <DropdownMenuItem
                        key={country.code}
                        onClick={() => setSelectedCountry(country)}
                      >
                        <img
                          src={country.flag}
                          alt={country.country}
                          className="w-5 h-4 rounded-sm"
                        />
                        <span>{country.ddi}</span>
                        <span className="text-muted-foreground text-xs">
                          {country.country}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
            <InputGroupInput
              id="phone"
              value={phone}
              onChange={(e) => setPhone(phoneMask(e.target.value))}
              placeholder="(00) 0000-0000"
              className="pl-0"
              disabled={isPending}
            />
          </InputGroup>
        </div>
      </div>

      <Separator />

      {/* ── E-mail ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">E-mail</h2>
          <span className="text-xs text-muted-foreground">
            Mude o e-mail exibido na interface
          </span>
        </div>
        <Input
          placeholder="Digite seu e-mail"
          value={session?.user?.email ?? ""}
          className="w-64"
          disabled
        />
      </div>

      <Separator />

      {/* ── User ID ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">User ID</h2>
          <span className="text-xs text-muted-foreground">
            Seu identificador único na plataforma
          </span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-200 dark:border-violet-800 min-h-13 w-72">
          {isPending ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-muted-foreground animate-pulse">
                Carregando...
              </span>
            </div>
          ) : (
            <>
              <code className="font-mono font-semibold text-xs text-violet-600 dark:text-violet-400 flex-1 text-center select-all truncate">
                {session?.user?.id ?? "—"}
              </code>
              {session?.user?.id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                  onClick={() => {
                    navigator.clipboard.writeText(session.user.id);
                    toast.success("ID copiado!");
                  }}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Acesse com meu link ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Acesse com meu link</h2>
          <span className="text-xs text-muted-foreground">
            Compartilhe e ganhe comissão por cada empresa cadastrada
          </span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-200 dark:border-violet-800 min-h-13 w-72">
          {isLoadingLink || !referralLink ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-muted-foreground animate-pulse">
                Gerando link...
              </span>
            </div>
          ) : (
            <>
              <code className="font-mono font-semibold text-xs text-violet-600 dark:text-violet-400 flex-1 select-all truncate">
                {referralLink.url}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                onClick={() => {
                  navigator.clipboard.writeText(referralLink.url);
                  toast.success("Link copiado!");
                }}
              >
                <CopyIcon className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Tema ── */}
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Tema</h2>
          <span className="text-xs text-muted-foreground">
            Mude o tema para o modo escuro
          </span>
        </div>
        <ModeToggle />
      </div>
    </div>
  );
}
