type InvitationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: InvitationPageProps) {
  const { id } = await params;
  return <div>Page {id}</div>;
}
