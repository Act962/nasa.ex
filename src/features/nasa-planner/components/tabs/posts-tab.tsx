"use client";

import { useState } from "react";
import {
  PlusIcon, SparklesIcon, TrashIcon, CheckCircle2Icon,
  ClockIcon, MoreVerticalIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNasaPlannerPosts, useCreatePlannerPost, useDeletePlannerPost,
  useGeneratePlannerPost, useApprovePlannerPost, useSchedulePlannerPost,
} from "../../hooks/use-nasa-planner";
import { POST_STATUSES, POST_TYPES, POST_NETWORKS } from "../../constants";

export function PostsTab({ plannerId }: { plannerId: string }) {
  const { posts, isLoading } = useNasaPlannerPosts(plannerId);
  const createPost = useCreatePlannerPost();
  const deletePost = useDeletePlannerPost();
  const generatePost = useGeneratePlannerPost();
  const approvePost = useApprovePlannerPost();
  const schedulePost = useSchedulePlannerPost();

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [newPost, setNewPost] = useState({ title: "", type: "IMAGE", networks: [] as string[], caption: "" });

  const handleCreatePost = async () => {
    if (!newPost.title.trim()) return;
    await createPost.mutateAsync({
      plannerId,
      title: newPost.title,
      type: newPost.type as "STATIC" | "CAROUSEL" | "REEL" | "STORY",
    });
    setCreateOpen(false);
    setNewPost({ title: "", type: "IMAGE", networks: [], caption: "" });
  };

  const handleDelete = async () => {
    if (!deletePostId) return;
    await deletePost.mutateAsync({ postId: deletePostId });
    setDeletePostId(null);
    if (selectedPost?.id === deletePostId) setSelectedPost(null);
  };

  const handleGenerate = (postId: string) => generatePost.mutateAsync({ postId, userPrompt: "" });
  const handleApprove = (postId: string) => approvePost.mutateAsync({ postId });

  const handleSchedule = async () => {
    if (!schedulePostId || !scheduleDate) return;
    await schedulePost.mutateAsync({ postId: schedulePostId, scheduledAt: new Date(scheduleDate).toISOString() });
    setSchedulePostId(null);
    setScheduleDate("");
  };

  const toggleNetwork = (network: string) =>
    setNewPost((prev) => ({
      ...prev,
      networks: prev.networks.includes(network)
        ? prev.networks.filter((n) => n !== network)
        : [...prev.networks, network],
    }));

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <p className="text-sm text-muted-foreground">{posts.length} posts no total</p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-3.5" />
          Novo Post
        </Button>
      </div>

      {/* Kanban board */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max min-h-full">
          {POST_STATUSES.map((col) => {
            const colPosts = posts.filter((p: any) => p.status === col.key);
            return (
              <div key={col.key} className="w-72 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{col.label}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-full">{colPosts.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {colPosts.map((post: any) => (
                    <Card
                      key={post.id}
                      className="cursor-pointer hover:shadow-sm transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                      onClick={() => setSelectedPost(post)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-2 flex-1">{post.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <MoreVerticalIcon className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleGenerate(post.id); }}>
                                <SparklesIcon className="size-3.5 mr-2" />Gerar com IA
                              </DropdownMenuItem>
                              {post.status === "PENDING_APPROVAL" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleApprove(post.id); }}>
                                  <CheckCircle2Icon className="size-3.5 mr-2" />Aprovar
                                </DropdownMenuItem>
                              )}
                              {post.status === "APPROVED" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSchedulePostId(post.id); }}>
                                  <ClockIcon className="size-3.5 mr-2" />Agendar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeletePostId(post.id); }}
                              >
                                <TrashIcon className="size-3.5 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {post.type && <Badge variant="outline" className="text-xs px-1.5 py-0">{POST_TYPES[post.type] ?? post.type}</Badge>}
                          {(post.networks ?? []).map((net: string) => (
                            <Badge key={net} variant="secondary" className="text-xs px-1.5 py-0">{POST_NETWORKS[net] ?? net}</Badge>
                          ))}
                        </div>
                        {post.scheduledAt && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {format(new Date(post.scheduledAt), "dd/MM HH:mm")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {colPosts.length === 0 && (
                    <div className="rounded-lg border border-dashed h-20 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Post Detail */}
      <Dialog open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="line-clamp-1">{selectedPost?.title}</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{selectedPost.status}</Badge>
                {selectedPost.type && <Badge variant="outline">{POST_TYPES[selectedPost.type] ?? selectedPost.type}</Badge>}
                {(selectedPost.networks ?? []).map((net: string) => (
                  <Badge key={net} variant="secondary">{POST_NETWORKS[net] ?? net}</Badge>
                ))}
              </div>
              {selectedPost.caption && (
                <div>
                  <Label className="text-xs text-muted-foreground">Legenda</Label>
                  <ScrollArea className="h-32 mt-1">
                    <p className="text-sm whitespace-pre-wrap">{selectedPost.caption}</p>
                  </ScrollArea>
                </div>
              )}
              {selectedPost.hashtags && (
                <div>
                  <Label className="text-xs text-muted-foreground">Hashtags</Label>
                  <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">{selectedPost.hashtags}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleGenerate(selectedPost.id)} disabled={generatePost.isPending}>
                  <SparklesIcon className="size-3.5" />
                  {generatePost.isPending ? "Gerando..." : "Gerar com IA"}
                </Button>
                {selectedPost.status === "PENDING_APPROVAL" && (
                  <Button size="sm" className="gap-1.5" onClick={() => handleApprove(selectedPost.id)}>
                    <CheckCircle2Icon className="size-3.5" />Aprovar
                  </Button>
                )}
                {selectedPost.status === "APPROVED" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedPost(null); setSchedulePostId(selectedPost.id); }}>
                    <ClockIcon className="size-3.5" />Agendar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ex: Post de lançamento do produto X" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POST_TYPES).map(([key, label]) => (
                  <Badge key={key} variant={newPost.type === key ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => setNewPost((p) => ({ ...p, type: key }))}>{label}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Redes Sociais</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POST_NETWORKS).map(([key, label]) => (
                  <Badge key={key} variant={newPost.networks.includes(key) ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => toggleNetwork(key)}>{label}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Legenda (opcional)</Label>
              <Textarea placeholder="Escreva a legenda ou deixe a IA gerar..." rows={3} value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePost} disabled={!newPost.title.trim() || createPost.isPending}>
              {createPost.isPending ? "Criando..." : "Criar Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={!!schedulePostId} onOpenChange={(o) => !o && setSchedulePostId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agendar Post</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Data e Hora</Label>
            <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulePostId(null)}>Cancelar</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate || schedulePost.isPending}>
              {schedulePost.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>Este post será excluído permanentemente. Deseja continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
