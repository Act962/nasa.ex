export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col ">
      <div className="w-full flex-1  pt-1">{children}</div>
    </div>
  );
}
