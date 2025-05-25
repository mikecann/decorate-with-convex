import { Card } from "../common/Card";
import React from "react";
import { isMobile } from "../common/utils";

interface UploadCardProps {
  onUpload: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (drag: boolean) => void;
}

export function UploadCard({
  onUpload,
  isDragging,
  setIsDragging,
}: UploadCardProps) {
  const mobile = isMobile();

  return (
    <Card
      className={`border-2 border-dashed p-10 text-center transition-colors flex flex-col items-center justify-center mb-8 ${
        isDragging
          ? "border-blue-400 bg-blue-50"
          : "border-[var(--color-border)] bg-white"
      }`}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) onUpload(file);
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl text-blue-400 mb-2">📸</div>
        <div>
          <p className="text-2xl font-bold text-slate-800 mb-1">
            Upload your image
          </p>
          <p className="text-base text-gray-500 mb-2">
            {mobile
              ? "Choose from gallery or take a photo"
              : "Drag & drop or select a file to get started"}
          </p>
          <div className={`mt-2 ${mobile ? "flex flex-col gap-2" : ""}`}>
            {/* Gallery/File picker */}
            <label className="inline-block cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                multiple={false}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onUpload(file);
                }}
              />
              <span className="button px-6 py-2">
                {mobile ? "📱 Choose from Gallery" : "Select a file"}
              </span>
            </label>

            {/* Camera option for mobile */}
            {mobile && (
              <label className="inline-block cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    onUpload(file);
                  }}
                />
                <span className="button px-6 py-2">📷 Take Photo</span>
              </label>
            )}

            {/* Debug info - remove this later */}
            {mobile && (
              <div className="text-xs text-gray-400 mt-2">
                Mobile detected: {mobile.toString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
