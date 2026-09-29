export default function OrbitaLegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark min-h-screen w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {children}
    </main>
  );
}
