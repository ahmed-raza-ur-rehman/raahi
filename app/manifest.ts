import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAAHI — راستہ دکھانے والا",
    short_name: "RAAHI",
    description:
      "Find verified routes to welfare, education, health, documents, jobs and disaster help in Pakistan. In Urdu, Pashto, Hindko and English.",
    // A visitor can start from the home screen, so it must work without a URL.
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#0f6b4f",
    orientation: "portrait",
    lang: "ur",
    dir: "rtl",
    categories: ["government", "education", "health", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/raahi.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Emergency", short_name: "1122", url: "/contacts", description: "Emergency numbers" },
      { name: "Ask Raahi", short_name: "Ask", url: "/ask", description: "Ask a question in your own language" },
      { name: "My applications", short_name: "Track", url: "/track", description: "Saved applications and progress" },
    ],
  };
}
