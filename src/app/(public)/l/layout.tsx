export default function LinnkerPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="w-full min-h-screen">{children}</main>;
}
