"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Video, Volume2, RefreshCw, Check, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  open:              boolean;
  onClose:           () => void;
  micOn:             boolean;
  camOn:             boolean;
  camError?:         string | null;
  onToggleMic:       () => void;
  onToggleCam:       () => void;
  localStream:       MediaStream | null;
  devices:           { audio: MediaDeviceInfo[]; video: MediaDeviceInfo[]; output: MediaDeviceInfo[] };
  selectedAudio:     string;
  setSelectedAudio:  (id: string) => void;
  selectedVideo:     string;
  setSelectedVideo:  (id: string) => void;
  selectedOutput:    string;
  setSelectedOutput: (id: string) => void;
  onApplyDevices:    () => void;
}

export function MediaSettingsPanel({
  open, onClose, micOn, camOn, camError, onToggleMic, onToggleCam,
  localStream, devices, selectedAudio, setSelectedAudio,
  selectedVideo, setSelectedVideo, selectedOutput, setSelectedOutput,
  onApplyDevices,
}: Props) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [micDialogOpen,    setMicDialogOpen]    = useState(false);
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);

  useEffect(() => {
    const el = videoPreviewRef.current;
    if (!el) return;
    if (localStream && camOn) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [localStream, camOn]);

  return (
    <>
      {/* ── Dialog principal ── */}
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm p-0 gap-0 overflow-hidden z-[51]">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-white text-base font-semibold">
              Configurações de mídia
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="settings" className="mt-4">
            {/* Tabs pill */}
            <TabsList className="mx-5 mb-1 h-9 bg-slate-800/60 border border-white/10 rounded-full p-1 gap-0.5">
              <TabsTrigger
                value="settings"
                className="flex-1 rounded-full text-xs font-medium text-slate-400
                  data-[state=active]:bg-indigo-600 data-[state=active]:text-white
                  data-[state=active]:shadow-sm transition-all"
              >
                Configurações
              </TabsTrigger>
              <TabsTrigger
                value="background"
                className="flex-1 rounded-full text-xs font-medium text-slate-400
                  data-[state=active]:bg-indigo-600 data-[state=active]:text-white
                  data-[state=active]:shadow-sm transition-all"
              >
                Fundo da câmera
              </TabsTrigger>
            </TabsList>

            {/* ── Aba: Configurações ── */}
            <TabsContent value="settings" className="p-5 flex flex-col gap-5 mt-0">

              {/* Erro de permissão */}
              {camError && (
                <div className="flex items-start gap-2 bg-rose-500/15 border border-rose-500/30 rounded-xl px-3 py-2.5">
                  <span className="text-rose-400 mt-0.5 shrink-0">⚠️</span>
                  <p className="text-xs text-rose-300 leading-snug">{camError}</p>
                </div>
              )}

              {/* Câmera */}
              <section>
                <label className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2 block">
                  Câmera
                </label>
                <div className="relative w-full aspect-video bg-slate-800 rounded-xl overflow-hidden mb-3">
                  {camOn && localStream ? (
                    <video
                      ref={videoPreviewRef}
                      muted autoPlay playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Video className="h-8 w-8" />
                      <span className="text-xs">Câmera desativada</span>
                    </div>
                  )}
                </div>
                {!camOn ? (
                  <>
                    <p className="text-xs text-slate-400 italic text-center mb-2">Sua câmera está desabilitada</p>
                    <Button
                      className="w-full bg-rose-500 hover:bg-rose-400 text-white rounded-xl h-9 text-sm font-semibold"
                      onClick={onToggleCam}
                    >
                      Ativar sua câmera
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedVideo}
                      onChange={e => setSelectedVideo(e.target.value)}
                      className="flex-1 bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none"
                    >
                      {devices.video.length === 0 && <option value="">Câmera padrão</option>}
                      {devices.video.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || "Câmera"}</option>
                      ))}
                    </select>
                    <button
                      onClick={onApplyDevices}
                      className="px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                      title="Aplicar dispositivo"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={onToggleCam}
                      className="px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 transition-colors text-xs font-semibold"
                    >
                      Desativar
                    </button>
                  </div>
                )}
              </section>

              {/* Microfone */}
              <section>
                <label className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2 block">
                  Microfone
                </label>
                {!micOn ? (
                  <>
                    <p className="text-xs text-slate-400 italic text-center mb-2">Seu microfone está desabilitado</p>
                    <Button
                      className="w-full bg-rose-500 hover:bg-rose-400 text-white rounded-xl h-9 text-sm font-semibold"
                      onClick={onToggleMic}
                    >
                      Ativar seu microfone
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setMicDialogOpen(true)}
                      className="flex-1 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                    >
                      <Mic className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="flex-1 text-left text-xs text-slate-200 truncate">
                        {devices.audio.find(d => d.deviceId === selectedAudio)?.label || "Microfone padrão"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    </button>
                    <button
                      onClick={onToggleMic}
                      className="px-2 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 transition-colors text-xs font-semibold whitespace-nowrap"
                    >
                      Desativar
                    </button>
                  </div>
                )}
              </section>

              {/* Saída de áudio */}
              <section>
                <label className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2 block">
                  Saída de áudio
                </label>
                <button
                  onClick={() => devices.output.length > 0 && setOutputDialogOpen(true)}
                  disabled={devices.output.length === 0}
                  className="w-full flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg px-3 py-2 transition-colors"
                >
                  <Volume2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span className="flex-1 text-left text-xs text-slate-200 truncate">
                    {devices.output.find(d => d.deviceId === selectedOutput)?.label || "Alto-falante padrão"}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                </button>
                {devices.output.length === 0 && (
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
                    Ative o microfone para liberar a seleção de alto-falante.
                  </p>
                )}
              </section>

            </TabsContent>

            {/* ── Aba: Fundo da câmera ── */}
            <TabsContent value="background" className="mt-0">
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Em breve</p>
                  <p className="text-slate-400 text-xs mt-1 leading-snug">
                    Fundos virtuais e desfoque estarão disponíveis em breve.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: seleção de microfone ── */}
      <Dialog open={micDialogOpen} onOpenChange={setMicDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm z-[52]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-sm">
              <Mic className="h-4 w-4 text-emerald-400" />
              Microfone
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 mt-1">
            {devices.audio.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum microfone encontrado.</p>
            ) : (
              devices.audio.map(d => {
                const active = selectedAudio === d.deviceId || (!selectedAudio && d.deviceId === "default");
                return (
                  <button
                    key={d.deviceId}
                    onClick={() => { setSelectedAudio(d.deviceId); onApplyDevices(); setMicDialogOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                      active ? "bg-emerald-500/20 border border-emerald-500/30" : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <span className="flex-1 text-sm text-slate-200 truncate">{d.label || "Microfone"}</span>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: seleção de saída de áudio ── */}
      <Dialog open={outputDialogOpen} onOpenChange={setOutputDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm z-[52]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-sm">
              <Volume2 className="h-4 w-4 text-sky-400" />
              Saída de áudio
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 mt-1">
            {devices.output.map(d => {
              const active = selectedOutput === d.deviceId || (!selectedOutput && d.deviceId === "default");
              return (
                <button
                  key={d.deviceId}
                  onClick={() => { setSelectedOutput(d.deviceId); setOutputDialogOpen(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                    active ? "bg-sky-500/20 border border-sky-500/30" : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="flex-1 text-sm text-slate-200 truncate">{d.label || "Alto-falante"}</span>
                  {active && <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
