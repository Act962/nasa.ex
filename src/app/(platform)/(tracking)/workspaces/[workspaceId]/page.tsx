import { NavWorkspace } from "@/features/workspace/components/nav-workspace";
import { WorkspaceBoard } from "@/features/workspace/components/workspace";
import { client } from "@/lib/orpc";

interface Props {
  params: Promise<{ workspaceId: string }>;
  searchParams?: Promise<{ actionId?: string }>;
}

export default async function Page({ params }: Props) {
  const { workspaceId } = await params;

  const { workspace } = await client.workspace.get({
    workspaceId,
  });

  return (
    <>
      <NavWorkspace workspaceId={workspaceId} title={workspace.name} />
      <WorkspaceBoard workspaceId={workspaceId} />
    </>
  );
}

// function getMetadataBaseUrl() {
//   const raw =
//     process.env.NEXT_PUBLIC_BASE_URL ??
//     process.env.BETTER_AUTH_URL ??
//     "https://orbita.nasaex.com";

//   try {
//     return new URL(raw);
//   } catch {
//     return new URL("https://orbita.nasaex.com");
//   }
// }

// function constructPublicUrl(keyOrUrl: string | null | undefined) {
//   if (!keyOrUrl) return undefined;
//   const value = keyOrUrl.trim();
//   if (!value) return undefined;

//   if (/^https?:\/\//i.test(value)) {
//     return value;
//   }

//   const bucketHost = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
//   if (!bucketHost) return undefined;

//   return `https://${bucketHost}/${value}`;
// }

// export async function generateMetadata({
//   params,
//   searchParams,
// }: Props): Promise<Metadata> {
//   const { workspaceId } = await params;
//   const { actionId } = (await searchParams) ?? {};

//   if (!actionId) {
//     return {};
//   }

//   const action = await prisma.action.findFirst({
//     where: {
//       id: actionId,
//       workspaceId,
//       isArchived: false,
//     },
//     select: {
//       title: true,
//       description: true,
//       coverImage: true,
//       workspace: {
//         select: { name: true },
//       },
//     },
//   });

//   if (!action) {
//     return {};
//   }

//   console.log("ACTION", action);

//   const title = `${action.title} | Nasa.ex`;
//   const description = "Descrição da ação";

//   const metadataBase = getMetadataBaseUrl();
//   const url = new URL(`/workspaces/${workspaceId}`, metadataBase);
//   url.searchParams.set("actionId", actionId);

//   const coverImageUrl = constructPublicUrl(action.coverImage);

//   return {
//     title,
//     description,
//     metadataBase,
//     alternates: {
//       canonical: url,
//     },
//     openGraph: {
//       title,
//       description,
//       url,
//       images: coverImageUrl ? [{ url: coverImageUrl }] : undefined,
//     },
//     twitter: {
//       card: coverImageUrl ? "summary_large_image" : "summary",
//       title,
//       description,
//       images: coverImageUrl ? [coverImageUrl] : undefined,
//     },
//   };
// }
