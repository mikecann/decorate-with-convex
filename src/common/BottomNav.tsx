import * as React from "react";
import { routes, useRoute } from "@/routes";
import { Button } from "@/common/Button";
import { cn, useImageUpload } from "@/common/utils";
import { LayoutDashboard, ImagePlus } from "lucide-react";
import { useRef } from "react";

interface Props {}

export const BottomNav: React.FC<Props> = ({}) => {
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
  );
};
