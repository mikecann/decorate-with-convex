import { Authenticated, Unauthenticated } from "convex/react";
import { Toaster } from "sonner";
import { useRoute } from "./routes";
import DashboardPage from "./dashboardPage/DashboardPage";
import { Id } from "../convex/_generated/dataModel";
import ImagePage from "./imagePage/ImagePage";
import { BottomNav } from "./common/BottomNav";
import { UnauthenticatedContent } from "@/auth/UnauthenticatedContent";
import { AppHeader } from "./common/AppHeader";

export default function App() {
  const route = useRoute();
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <main className="flex-1 flex flex-col">
        <Authenticated>
          <AppHeader />
          {route.name === "dashboard" && <DashboardPage />}
          {route.name === "image" && (
            <ImagePage imageId={route.params.imageId as Id<"images">} />
          )}
          <BottomNav />
        </Authenticated>
        <Unauthenticated>
          <UnauthenticatedContent />
        </Unauthenticated>
      </main>

      <Toaster />
    </div>
  );
}
