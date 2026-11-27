-- Spec 0152: exceção de permissão por usuário, sobre a matriz por papel.
CREATE TABLE "member_app_permission" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL,
    "can_create" BOOLEAN NOT NULL,
    "can_edit" BOOLEAN NOT NULL,
    "can_delete" BOOLEAN NOT NULL,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "can_pay" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_app_permission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_app_permission_organization_id_user_id_app_key_key" ON "member_app_permission"("organization_id", "user_id", "app_key");
CREATE INDEX "member_app_permission_organization_id_user_id_idx" ON "member_app_permission"("organization_id", "user_id");

ALTER TABLE "member_app_permission" ADD CONSTRAINT "member_app_permission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_app_permission" ADD CONSTRAINT "member_app_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
