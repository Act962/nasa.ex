"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { parsePhone } from "../../utils/profile-utils";
import { SettingsRow } from "../settings-row";
import { CopyValueField } from "./copy-value-field";
import { ProfileAvatarPicker } from "./profile-avatar-picker";
import { ProfilePhoneInput } from "./profile-phone-input";
import { ThemeSelector } from "./theme-selector";

const NAME_AUTOSAVE_DELAY_MS = 5000;
const PHONE_AUTOSAVE_DELAY_MS = 500;

/** Perfil do usuário — tudo salva sozinho, sem botão de salvar. */
export function ProfileSettings() {
  const { data: session, isPending, refetch } = authClient.useSession();

  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phone, setPhone] = useState("");

  const sessionName = session?.user?.name ?? "";
  const sessionPhone =
    (session?.user as { phone?: string | null } | undefined)?.phone ?? "";

  useEffect(() => {
    if (!session?.user) return;
    setName(session.user.name ?? "");
    setImage(session.user.image ?? null);
    const parsedPhone = parsePhone(sessionPhone);
    setSelectedCountry(parsedPhone.country);
    setPhone(phoneMask(parsedPhone.number));
    // Depende do id para rodar uma vez por usuário; usar `session.user` (referência)
    // fazia o effect re-disparar a cada refetch pós-mutate e sobrescrever a digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const updateProfileMutation = useMutation({
    mutationFn: (input: { name?: string; image?: string; phone?: string }) =>
      orpc.user.updateProfile.call(input),
    onSuccess: async () => {
      await refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Erro ao atualizar perfil.");
    },
  });

  const { data: referralLink, isLoading: isLoadingLink } = useQuery(
    orpc.partner.getMyLink.queryOptions(),
  );

  const debouncedName = useDebouncedValue(name, NAME_AUTOSAVE_DELAY_MS);
  const phoneDigits = normalizePhone(phone);
  const debouncedPhoneDigits = useDebouncedValue(phoneDigits, PHONE_AUTOSAVE_DELAY_MS);
  const debouncedDdi = useDebouncedValue(selectedCountry.ddi, PHONE_AUTOSAVE_DELAY_MS);

  useEffect(() => {
    if (!session?.user) return;
    const trimmedName = debouncedName.trim();
    if (!trimmedName) return;
    if (trimmedName === sessionName) return;
    updateProfileMutation.mutate({ name: trimmedName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, session?.user, sessionName]);

  useEffect(() => {
    if (!session?.user) return;
    const nextPhone = debouncedPhoneDigits ? `${debouncedDdi} ${debouncedPhoneDigits}` : "";
    if (nextPhone === (sessionPhone ?? "")) return;
    updateProfileMutation.mutate({ phone: nextPhone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhoneDigits, debouncedDdi, session?.user, sessionPhone]);

  const handleImageSelected = (base64Image: string) => {
    setImage(base64Image);
    updateProfileMutation.mutate({ image: base64Image });
  };

  return (
    <div className="px-4">
      <SettingsRow
        title="Foto de perfil"
        description="Toque na foto para trocar a imagem"
        isInlineOnMobile
      >
        <ProfileAvatarPicker
          name={name}
          image={image}
          isLoading={isPending}
          isSaving={updateProfileMutation.isPending}
          onImageSelected={handleImageSelected}
        />
      </SettingsRow>

      <Separator />

      <SettingsRow title="Nome" description="Como seu nome aparece para a equipe">
        <Input
          placeholder="Digite seu nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
          className="h-11 sm:h-9"
        />
      </SettingsRow>

      <Separator />

      <SettingsRow title="Telefone" description="Escolha o país e digite seu número">
        <ProfilePhoneInput
          selectedCountry={selectedCountry}
          phone={phone}
          isDisabled={isPending}
          onCountryChange={setSelectedCountry}
          onPhoneChange={setPhone}
        />
      </SettingsRow>

      <Separator />

      <SettingsRow title="E-mail" description="O e-mail que você usa para entrar">
        <Input
          placeholder="Digite seu e-mail"
          value={session?.user?.email ?? ""}
          className="h-11 sm:h-9"
          disabled
        />
      </SettingsRow>

      <Separator />

      <SettingsRow title="Seu ID" description="Seu código único na plataforma">
        <CopyValueField
          value={session?.user?.id}
          isLoading={isPending}
          loadingLabel="Carregando..."
          copiedMessage="ID copiado!"
          isCentered
        />
      </SettingsRow>

      <Separator />

      <SettingsRow
        title="Acesse com meu link"
        description="Compartilhe e ganhe comissão por cada empresa cadastrada"
      >
        <CopyValueField
          value={referralLink?.url}
          isLoading={isLoadingLink || !referralLink}
          loadingLabel="Gerando link..."
          copiedMessage="Link copiado!"
        />
      </SettingsRow>

      <Separator />

      <SettingsRow title="Tema" description="Claro, escuro ou igual ao do aparelho">
        <ThemeSelector />
      </SettingsRow>
    </div>
  );
}
