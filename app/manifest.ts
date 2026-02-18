import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fit Plan",
    short_name: "FitPlan",
    description: "Seguimiento de entrenamiento, nutricion y progreso",
    start_url: "/today",
    display: "standalone",
    background_color: "#f3f4fb",
    theme_color: "#6c5dd3",
    icons: [
      {
        src: "/brand/logo-transparent.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/logo-transparent.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/logo-bg.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
