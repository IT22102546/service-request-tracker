import { Header } from "@/components/Header";
import { RequireAuth } from "@/components/RequireAuth";

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <RequireAuth>{children}</RequireAuth>
      </main>
    </>
  );
}
