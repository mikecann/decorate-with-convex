import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/common/Card";
import { Button } from "@/common/Button";
import { SignOutButton } from "@/auth/SignOutButton";
import { toast } from "sonner";

export default function SettingsPage() {
  const user = useQuery(api.images.getCurrentUser);
  const userSettings = useQuery(api.userSettings.getUserSettings);
  const updateSettings = useMutation(api.userSettings.updateUserSettings);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleImageModelChange = async (
    newModel: "openai/gpt-image-1" | "google/gemini-2.5-flash-image-preview"
  ) => {
    setIsUpdating(true);
    try {
      await updateSettings({ imageModel: newModel });
      toast.success("Settings updated successfully");
    } catch (error) {
      toast.error("Failed to update settings");
      console.error("Error updating settings:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (user === undefined || userSettings === undefined) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <Card className="p-6">
            <p className="text-gray-600">Not authenticated</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {user._id}
              </p>
            </div>

            {user.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
            )}

            {user.name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <p className="text-sm text-gray-900">{user.name}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Created
              </label>
              <p className="text-sm text-gray-900">
                {new Date(user._creationTime).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Image Generation Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Image Model
              </label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="google-model"
                    name="imageModel"
                    value="google/gemini-2.5-flash-image-preview"
                    checked={
                      userSettings.imageModel ===
                      "google/gemini-2.5-flash-image-preview"
                    }
                    onChange={() =>
                      handleImageModelChange(
                        "google/gemini-2.5-flash-image-preview"
                      )
                    }
                    disabled={isUpdating}
                    className="mr-3"
                  />
                  <label
                    htmlFor="google-model"
                    className="text-sm text-gray-900"
                  >
                    Google Gemini 2.5 Flash (Default)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="openai-model"
                    name="imageModel"
                    value="openai/gpt-image-1"
                    checked={userSettings.imageModel === "openai/gpt-image-1"}
                    onChange={() =>
                      handleImageModelChange("openai/gpt-image-1")
                    }
                    disabled={isUpdating}
                    className="mr-3"
                  />
                  <label
                    htmlFor="openai-model"
                    className="text-sm text-gray-900"
                  >
                    OpenAI GPT Image 1
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Current selection:{" "}
                <span className="font-medium">{userSettings.imageModel}</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="flex justify-start">
            <SignOutButton />
          </div>
        </Card>
      </div>
    </div>
  );
}
