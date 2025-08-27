export default function ConvexCorner() {
  return (
    <a
      href="https://convex.dev"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-0 left-0 z-50 group"
      aria-label="Made with Convex"
      title="Made with Convex"
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 250 250"
        className="fill-gray-600 hover:fill-gray-500 transition-colors"
      >
        {/* Bottom-left triangle */}
        <path d="M0,250 L0,0 L250,250 Z" />
      </svg>
      {/* Convex logo positioned over the triangle */}
      <img
        src="/convex.svg"
        alt="Convex"
        className="absolute bottom-2 left-2 w-8 h-8 group-hover:scale-110 transition-transform duration-200"
      />
    </a>
  );
}
