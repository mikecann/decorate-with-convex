import { Authenticated, Unauthenticated } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useRoute, routes } from "./routes";
import Dashboard from "./Dashboard";
import { Button } from "./common/Button";
import { cn } from "./lib/utils";

import { Id } from "../convex/_generated/dataModel";
import ImagePage from "./ImagePage";
import { LayoutDashboard, ImagePlus } from "lucide-react";
import { useRef } from "react";
import { useImageUpload } from "./lib/utils";

export default function App() {
  const route = useRoute();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const handleUpload = useImageUpload();
  const handleUploadButtonClick = () => {
    uploadInputRef.current?.click();
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  };
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <Authenticated>
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md p-4 flex justify-between items-center border-b border-[var(--color-border)] shadow-sm">
          <div className="flex items-center">
            {route.name === "image" ? (
              <Button
                variant="secondary"
                className="rounded-full shadow text-gray-700 hover:bg-gray-100 flex items-center"
                onClick={() => routes.dashboard().push()}
                aria-label="Back"
              >
                <span className="text-xl mr-1">←</span> Back
              </Button>
            ) : (
              <img
                src="/logo.png"
                alt="Logo"
                className="h-10 w-auto max-w-[180px]"
              />
            )}
          </div>
          <SignOutButton />
        </header>
      </Authenticated>
      <main className="flex-1 flex flex-col">
        <Authenticated>
          {route.name === "dashboard" && <Dashboard />}
          {route.name === "image" && (
            <ImagePage imageId={route.params.imageId as Id<"images">} />
          )}
        </Authenticated>
        <Unauthenticated>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md mx-auto card">
              <div className="text-center mb-8 flex flex-col items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-16 w-auto max-w-[220px] mb-4"
                />
                <p className="text-xl text-slate-600">Sign in to get started</p>
              </div>
              <SignInForm />
            </div>
          </div>
        </Unauthenticated>
      </main>
      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--color-border)] shadow-lg flex md:hidden justify-around py-2 px-4">
        <Button
          variant="link"
          className={cn(
            "flex flex-col items-center text-xs font-medium",
            route.name === "dashboard" ? "accent-text" : "text-gray-400"
          )}
          onClick={() => routes.dashboard().push()}
        >
          <LayoutDashboard className="w-6 h-6 mb-1" />
          <span>Dashboard</span>
        </Button>
        <Button
          variant="link"
          className={cn(
            "flex flex-col items-center text-xs font-medium",
            route.name === "image" ? "accent-text" : "text-gray-400"
          )}
          onClick={handleUploadButtonClick}
        >
          <ImagePlus className="w-6 h-6 mb-1" />
          <span>Upload</span>
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </nav>
      <Toaster />
    </div>
  );
}
