import type { MetadataRoute } from "next";
import { posts } from "@/lib/blog";
import { solutions } from "@/lib/solutions";
import { absolute } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ["/", "/pricing", "/solutions", "/blog", "/about", "/privacy", "/terms"];
  return [
    ...fixed.map((path) => ({ url: absolute(path), changeFrequency: "monthly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...solutions.map((s) => ({ url: absolute(`/solutions/${s.slug}`), changeFrequency: "monthly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: absolute(`/blog/${p.slug}`), lastModified: p.date, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
