"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  Globe,
  Users,
  Settings,
  Gamepad2,
  Star,
  ExternalLink,
} from "lucide-react";
import {
  useMyStation,
  useCreateStation,
  useUpdateStation,
  useUpdateWorld,
  useUpdateModules,
} from "../hooks/use-station";
import { MyStationsList } from "./my-stations-list";
import { AMBIENT_THEMES, MODULE_ICONS, MODULE_LABELS } from "../types";
import type { StationModule, AmbientTheme } from "../types";

const stationSchema = z.object({
  nick: z
    .string()
    .min(2)
    .max(30)
    .regex(
      /^[a-z0-9_-]+$/,
      "Apenas letras minúsculas, números, hífens e underscores",
    ),
  bio: z.string().max(300).optional(),
  isPublic: z.boolean(),
});

type StationForm = z.infer<typeof stationSchema>;

const ALL_MODULES: StationModule[] = [
  "FORM",
  "CHAT",
  "AGENDA",
  "INTEGRATION",
  "NBOX",
  "FORGE",
  "APPS",
  "NOTIFICATIONS",
];

export function SpaceStationAdmin() {
  const { data: myData, isLoading } = useMyStation("ORG");
  const createStation = useCreateStation();
  const updateStation = useUpdateStation();
  const updateWorld = useUpdateWorld();
  const updateModules = useUpdateModules();

  const station = myData?.station;

  const [planetColor, setPlanetColor] = useState("#4B0082");
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme>("space");
  const [suitColor, setSuitColor] = useState("#4f46e5");
  const [helmetColor, setHelmetColor] = useState("#818cf8");
  const [accessory, setAccessory] = useState<"none" | "flag" | "jetpack">(
    "none",
  );
  const [activeModules, setActiveModules] = useState<Set<StationModule>>(
    new Set(),
  );

  const form = useForm<StationForm>({
    resolver: zodResolver(stationSchema),
    defaultValues: { nick: "", bio: "", isPublic: false },
  });

  useEffect(() => {
    if (station) {
      form.reset({
        nick: station.nick,
        bio: station.bio ?? "",
        isPublic: station.isPublic,
      });
      if (station.worldConfig) {
        setPlanetColor(station.worldConfig.planetColor ?? "#4B0082");
        setAmbientTheme(
          (station.worldConfig.ambientTheme as AmbientTheme) ?? "space",
        );
        const av = station.worldConfig.avatarConfig as {
          suitColor?: string;
          helmetColor?: string;
          accessory?: string;
        } | null;
        if (av) {
          setSuitColor(av.suitColor ?? "#4f46e5");
          setHelmetColor(av.helmetColor ?? "#818cf8");
          setAccessory((av.accessory as typeof accessory) ?? "none");
        }
      }
      const mods = new Set(
        station.publicModules
          .filter((m) => m.isActive)
          .map((m) => m.module as StationModule),
      );
      setActiveModules(mods);
    }
  }, [station]);

  async function onSubmitProfile(data: StationForm) {
    try {
      if (!station) {
        await createStation.mutateAsync({
          type: "ORG",
          nick: data.nick,
          bio: data.bio,
        });
        toast.success("Space Station criada!");
      } else {
        await updateStation.mutateAsync({
          id: station.id,
          bio: data.bio,
          isPublic: data.isPublic,
        });
        toast.success("Perfil atualizado!");
      }
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message ?? "Erro ao salvar");
    }
  }

  async function onSaveWorld() {
    if (!station) return;
    try {
      await updateWorld.mutateAsync({
        stationId: station.id,
        planetColor,
        ambientTheme,
        avatarConfig: {
          suitColor,
          helmetColor,
          accessory,
          skinTone: "#f5cba7",
        },
      });
      toast.success("Mundo configurado!");
    } catch {
      toast.error("Erro ao salvar configuração do mundo");
    }
  }

  async function onSaveModules() {
    if (!station) return;
    try {
      await updateModules.mutateAsync({
        stationId: station.id,
        modules: ALL_MODULES.map((m) => ({
          module: m,
          isActive: activeModules.has(m),
        })),
      });
      toast.success("Módulos atualizados!");
    } catch {
      toast.error("Erro ao atualizar módulos");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Lista de stations do usuário */}
      <MyStationsList />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-600/20">
          <Rocket className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Space Station</h1>
          <p className="text-sm text-slate-400">
            Configure o ambiente virtual público da sua empresa
          </p>
        </div>
        {station && (
          <Badge
            variant="outline"
            className={
              station.isPublic
                ? "border-green-500/30 text-green-400 ml-auto"
                : "border-slate-500/30 text-slate-400 ml-auto"
            }
          >
            {station.isPublic ? "● Pública" : "○ Privada"}
          </Badge>
        )}
      </div>

      {/* Perfil */}
      <Card className="bg-slate-900 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            Identidade da Station
          </CardTitle>
          <CardDescription>
            Define como sua empresa aparece para o mundo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-300">@Nick único</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 text-sm">@</span>
              <Input
                {...form.register("nick")}
                placeholder="suaempresa"
                disabled={!!station}
                className="bg-slate-800 border-white/10 text-white"
              />
            </div>
            {form.formState.errors.nick && (
              <p className="text-red-400 text-xs mt-1">
                {form.formState.errors.nick.message}
              </p>
            )}
            {station && (
              <p className="text-slate-500 text-xs mt-1">
                O @nick não pode ser alterado após criação.
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-300">Bio</Label>
            <Textarea
              {...form.register("bio")}
              placeholder="Descreva sua empresa em poucas palavras..."
              className="bg-slate-800 border-white/10 text-white resize-none mt-1"
              rows={3}
            />
          </div>

          {station && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div>
                <p className="text-white text-sm font-medium">
                  Station Pública
                </p>
                <p className="text-slate-400 text-xs">
                  Permite que qualquer pessoa visite sua station
                </p>
              </div>
              <Switch
                checked={form.watch("isPublic")}
                onCheckedChange={(v) => form.setValue("isPublic", v)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={form.handleSubmit(onSubmitProfile)}
              disabled={createStation.isPending || updateStation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {station ? "Salvar Perfil" : "Criar Space Station"}
            </Button>
            {station?.nick && (
              <Button
                variant="outline"
                className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-600/10 hover:text-indigo-300"
                asChild
              >
                <a
                  href={`/station/${station.nick}/world`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Space Station
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {station && (
        <>
          {/* Módulos públicos */}
          <Card className="bg-slate-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-indigo-400" />
                Módulos Públicos
              </CardTitle>
              <CardDescription>
                Escolha quais serviços aparecerão na sua página pública
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_MODULES.map((m) => {
                  const active = activeModules.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const next = new Set(activeModules);
                        if (active) next.delete(m);
                        else next.add(m);
                        setActiveModules(next);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        active
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="text-2xl mb-1">{MODULE_ICONS[m]}</div>
                      <div className="text-xs font-medium">
                        {MODULE_LABELS[m]}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={onSaveModules}
                disabled={updateModules.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Salvar Módulos
              </Button>
            </CardContent>
          </Card>

          {/* Mundo 2D */}
          <Card className="bg-slate-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-indigo-400" />
                Mundo Virtual 2D
              </CardTitle>
              <CardDescription>
                Configure o ambiente pixel art da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tema ambiental */}
              <div>
                <Label className="text-slate-300 mb-2 block">
                  Tema do Ambiente
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {AMBIENT_THEMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAmbientTheme(t.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        ambientTheme === t.value
                          ? "bg-indigo-600/20 border-indigo-500/50"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <p className="text-white text-sm font-medium">
                        {t.label}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {t.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor do planeta */}
              <div>
                <Label className="text-slate-300 mb-2 block">
                  Cor do Planeta
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={planetColor}
                    onChange={(e) => setPlanetColor(e.target.value)}
                    className="h-10 w-16 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                  />
                  <span className="text-slate-400 font-mono text-sm">
                    {planetColor}
                  </span>
                </div>
              </div>

              {/* Avatar padrão */}
              <div>
                <Label className="text-slate-300 mb-2 block">
                  Traje Padrão da Tripulação
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">
                      Cor do Traje
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={suitColor}
                        onChange={(e) => setSuitColor(e.target.value)}
                        className="h-8 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <span className="text-slate-500 font-mono text-xs">
                        {suitColor}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">
                      Cor do Capacete
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={helmetColor}
                        onChange={(e) => setHelmetColor(e.target.value)}
                        className="h-8 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <span className="text-slate-500 font-mono text-xs">
                        {helmetColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-xs text-slate-400 mb-1 block">
                    Acessório
                  </Label>
                  <Select
                    value={accessory}
                    onValueChange={(v) => setAccessory(v as typeof accessory)}
                  >
                    <SelectTrigger className="bg-slate-800 border-white/10 text-white w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10">
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="flag">🚩 Bandeira</SelectItem>
                      <SelectItem value="jetpack">🚀 Jetpack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={onSaveWorld}
                disabled={updateWorld.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Salvar Mundo
              </Button>
            </CardContent>
          </Card>

          {/* Organograma */}
          <Card className="bg-slate-900 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                Organograma
              </CardTitle>
              <CardDescription>
                Configure Comandantes e Tripulação na seção de membros da
                organização. Membros com cargo "owner" são automaticamente
                Comandantes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                Acesse{" "}
                <span className="font-mono text-indigo-400">
                  Configurações → Membros
                </span>{" "}
                para definir o rank de cada membro como Comandante ou
                Tripulação.
              </p>
            </CardContent>
          </Card>

          {/* Preview link */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
            <Star className="h-5 w-5 text-indigo-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">
                Sua Space Station pública
              </p>
              <a
                href={`/@${station.nick}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 text-sm hover:underline font-mono"
              >
                nasaagents.com/@{station.nick}
              </a>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-500/30 text-indigo-400"
              asChild
            >
              <a
                href={`/@${station.nick}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visitar
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
