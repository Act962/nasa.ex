"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Spinner } from "@/components/spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { authClient } from "@/lib/auth-client";
import { POST_STATUSES } from "../../constants";
import {
  useApprovePlannerPost, useDeletePlannerPost, useGeneratePlannerPost,
  useNasaPlannerPosts, usePublishPlannerPost, useUpdatePlannerPost,
} from "../../hooks/use-nasa-planner";
import { useNetworkConnectionStatus } from "../../hooks/use-network-status";
import { ImageEditorDialog } from "../image-editor/image-editor-dialog";
import { BoardPostDialog } from "../posts-board/board-post-dialog";
import { CreatePostDialog } from "../posts-board/create-post-dialog";
import { ImageViewerDialog } from "../posts-board/image-viewer-dialog";
import { PostBoardCard } from "../posts-board/post-board-card";
import { SchedulePostDialog } from "../posts-board/schedule-post-dialog";
import { VideoEditorDialog } from "../video-editor/video-editor-dialog";

export function PostsTab({ plannerId }: { plannerId: string }) {
  const { posts, isLoading } = useNasaPlannerPosts(plannerId);
  const { isConnected } = useNetworkConnectionStatus();
  const { data: organizations } = authClient.useListOrganizations();
  const deletePost = useDeletePlannerPost();
  const generatePost = useGeneratePlannerPost();
  const approvePost = useApprovePlannerPost();
  const publishPost = usePublishPlannerPost();
  const updatePost = useUpdatePlannerPost();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [imageEditorPostId, setImageEditorPostId] = useState<string | null>(null);
  const [videoEditorPostId, setVideoEditorPostId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);

  const findPost = (postId: string | null) => (postId ? (posts.find((post) => post.id === postId) ?? null) : null);
  // Sempre a partir da lista viva, para a miniatura atualizar depois de gerar a imagem.
  const selectedPost = findPost(selectedPostId);
  const videoEditorPost = findPost(videoEditorPostId);
  const imageEditorPost = findPost(imageEditorPostId);

  const handleDelete = async () => {
    if (!deletePostId) return;
    await deletePost.mutateAsync({ postId: deletePostId });
    setDeletePostId(null);
    if (selectedPostId === deletePostId) setSelectedPostId(null);
  };

  const handleGenerate = (postId: string) => generatePost.mutateAsync({ postId, userPrompt: "" });
  const handleApprove = (postId: string) => approvePost.mutateAsync({ postId });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <p className="text-sm text-muted-foreground">{posts.length} posts no total</p>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setIsCreateOpen(true)}
          data-guide={GUIDE_ANCHORS.plannerNewPostButton.id}
        >
          <PlusIcon className="size-3.5" />
          Novo Post
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max min-h-full">
          {POST_STATUSES.map((statusColumn) => {
            const columnPosts = posts.filter((post) => post.status === statusColumn.key);
            return (
              <div key={statusColumn.key} className="w-72 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{statusColumn.label}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-full">{columnPosts.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {columnPosts.map((post) => (
                    <PostBoardCard
                      key={post.id}
                      post={post}
                      clientLogoUrl={(organizations ?? []).find((organization) => organization.name === post.clientOrgName)?.logo}
                      isNetworkConnected={isConnected}
                      actions={{
                        onOpen: () => setSelectedPostId(post.id),
                        onEditImage: () => setImageEditorPostId(post.id),
                        onEditVideo: () => setVideoEditorPostId(post.id),
                        onGenerate: () => handleGenerate(post.id),
                        onApprove: () => handleApprove(post.id),
                        onSchedule: () => setSchedulePostId(post.id),
                        onPublish: () => publishPost.mutate({ postId: post.id }),
                        onMove: (status) => updatePost.mutate({ postId: post.id, status }),
                        onDelete: () => setDeletePostId(post.id),
                      }}
                    />
                  ))}
                  {columnPosts.length === 0 && (
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

      <BoardPostDialog
        post={selectedPost}
        isUpdating={updatePost.isPending}
        isGenerating={generatePost.isPending}
        onClose={() => setSelectedPostId(null)}
        onUpdate={(patch) => selectedPost && updatePost.mutate({ postId: selectedPost.id, ...patch })}
        onGenerate={handleGenerate}
        onApprove={handleApprove}
        onSchedule={(postId) => { setSelectedPostId(null); setSchedulePostId(postId); }}
        onViewImage={setViewImageUrl}
      />

      <CreatePostDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} plannerId={plannerId} />
      <SchedulePostDialog postId={schedulePostId} onClose={() => setSchedulePostId(null)} />
      <ImageViewerDialog imageUrl={viewImageUrl} downloadTitle={selectedPost?.title ?? undefined} onClose={() => setViewImageUrl(null)} />

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

      {videoEditorPostId && (
        <VideoEditorDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setVideoEditorPostId(null); }}
          postId={videoEditorPostId}
          postTitle={videoEditorPost?.title ?? undefined}
          post={videoEditorPost}
        />
      )}

      {imageEditorPostId && (
        <ImageEditorDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setImageEditorPostId(null); }}
          postId={imageEditorPostId}
          plannerId={plannerId}
          initialImageKey={imageEditorPost?.thumbnail}
          initialHeadline={imageEditorPost?.slides?.[0]?.headline ?? imageEditorPost?.title ?? null}
          initialSubtext={imageEditorPost?.slides?.[0]?.subtext ?? imageEditorPost?.caption ?? null}
          slides={imageEditorPost?.slides ?? []}
          post={imageEditorPost}
        />
      )}
    </div>
  );
}
