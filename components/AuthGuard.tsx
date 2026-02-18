"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/hooks/useAuth";

const PUBLIC_PATHS = new Set(["/login"]);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated && !isPublic) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/today");
    }
  }, [isAuthenticated, isPublic, isReady, pathname, router]);

  if (!isReady) {
    return (
      <div className="p-4">
        <Skeleton lines={4} />
      </div>
    );
  }

  if (!isAuthenticated && !isPublic) {
    return null;
  }

  if (isAuthenticated && pathname === "/login") {
    return null;
  }

  return <>{children}</>;
}
