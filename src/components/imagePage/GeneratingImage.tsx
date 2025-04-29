interface GeneratingImageProps {
  imageUrl: string;
  prompt: string;
}

export function GeneratingImage({ imageUrl, prompt }: GeneratingImageProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="flex items-center justify-center w-full h-full p-4">
        <img
          src={imageUrl}
          alt="Original"
          className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg transition-all duration-300"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-gray-200 mb-4 bg-white/80"></div>
          <span className="text-xl text-gray-700 font-semibold mb-2">
            Generating this may take a minute or two...
          </span>
          <span className="text-base text-gray-600 text-center px-2">
            Prompt: <span className="italic">{prompt}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
