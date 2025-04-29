import * as React from "react";
import { SignOutButton } from "@/auth/SignOutButton";
import { routes, useRoute } from "@/routes";
import { Button } from "@/common/Button";

interface Props {}

export const AppHeader: React.FC<Props> = ({}) => {
  const route = useRoute();

  return (
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
  );
};
