import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleBadge, initials } from "./role-config";

interface Member {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member" | "moderador";
  createdAt: Date | string;
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

interface MemberListProps {
  members: Member[];
  currentUserId?: string;
  isMaster: boolean;
  canManage: boolean;
  onUpdateRole: (memberId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export function MemberList({
  members,
  currentUserId,
  isMaster,
  canManage,
  onUpdateRole,
  onRemoveMember,
}: MemberListProps) {
  return (
    <div className="rounded-xl border overflow-hidden">
      {members.map((member, i) => {
        const isMe = member.userId === currentUserId;
        return (
          <div
            key={member.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors",
              i < members.length - 1 && "border-b",
              isMe && "bg-muted/20",
            )}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarImage
                src={member.user.image ?? ""}
                alt={member.user.name}
              />
              <AvatarFallback className="text-xs">
                {initials(member.user.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">
                  {member.user.name}
                </span>
                {isMe && (
                  <span className="text-[10px] text-muted-foreground">
                    (você)
                  </span>
                )}
                <RoleBadge role={member.role} size="xs" />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {member.user.email}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Entrou em{" "}
                {new Date(member.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            {/* Actions — only if canManage and not self (unless master changing own role) */}
            {canManage && !isMe && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Role selector */}
                <Select
                  value={member.role}
                  onValueChange={(val) => onUpdateRole(member.id, val)}
                  disabled={!isMaster && member.role === "owner"}
                >
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Master</SelectItem>
                    <SelectItem value="admin">Adm</SelectItem>
                    <SelectItem value="member">Single</SelectItem>
                    <SelectItem value="moderador">Moderador</SelectItem>
                  </SelectContent>
                </Select>

                {/* Remove */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <UserX className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remover {member.user.name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        O usuário perderá acesso imediato à empresa. Esta
                        ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRemoveMember(member.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
