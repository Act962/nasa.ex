import { redirect } from "next/navigation";

/** Rota antiga dos planos: os ajustes agora vivem todos em /admin/trafego/settings. */
export default function AdminTrafegoPlansPage() {
  redirect("/admin/trafego/settings");
}
