import { setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { requireSessionUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSessionUser({ redirectTo: `/${locale}/login` });
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
