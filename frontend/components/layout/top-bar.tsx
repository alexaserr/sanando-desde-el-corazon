"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { logoutUser } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      logout();
      router.replace("/login");
    }
  };

  return (
    <header className="h-16 bg-terra-50/80 backdrop-blur-sm shadow-[0_1px_0_rgba(61,26,15,0.05)] flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm text-terra-700 font-medium">
            <User className="h-4 w-4 text-terra-400" />
            <span>{user.full_name}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-terra-400 hover:text-terra-700"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}
