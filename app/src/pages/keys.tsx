import { Loader2 } from "lucide-react";
import { KeysAdminPage } from "@/pages/keys-admin";
import { KeysStandardPage } from "@/pages/keys-standard";
import { useAuth } from "@/lib/auth";

export function KeysPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return user.role === "standard" ? <KeysStandardPage /> : <KeysAdminPage />;
}
