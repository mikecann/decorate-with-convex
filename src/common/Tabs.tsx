import React from "react";
import { Button } from "./Button";
import { cn } from "../lib/utils";

interface TabsProps {
  tabs: string[];
  selectedIndex: number;
  onTabChange: (index: number) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  selectedIndex,
  onTabChange,
  className = "",
}) => {
  return (
    <div
      className={cn(
        "flex bg-gray-100 rounded-lg p-1 w-fit mx-auto mb-2 border border-gray-200",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab, idx) => (
        <Button
          key={tab}
          variant="link"
          className={cn(
            "px-6 py-2 rounded-md transition font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            selectedIndex === idx
              ? "bg-white shadow text-black"
              : "bg-gray-100 text-gray-500"
          )}
          onClick={() => onTabChange(idx)}
          aria-selected={selectedIndex === idx}
          aria-controls={`tab-panel-${idx}`}
          role="tab"
          tabIndex={selectedIndex === idx ? 0 : -1}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
};

export default Tabs;
