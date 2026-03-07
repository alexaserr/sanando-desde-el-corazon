import { ClinicSidebar } from "@/components/layout/clinic-sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default function ClinicaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-crema">
      <ClinicSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
