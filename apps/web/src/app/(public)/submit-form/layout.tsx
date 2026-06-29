export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className="w-full h-screen">{children}</main>;
}
