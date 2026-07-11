import { site } from "@/lib/site";
import { getAllPosts } from "@/lib/posts";

export const dynamic = "force-static";

export default function sitemap() {
  const routes = [
    "",
    "/services",
    "/blog",
    "/calculators",
    "/calculators/miluim",
    "/faq",
    "/about",
    "/contact",
    "/privacy",
    "/accessibility",
  ].map((route) => ({
    url: `${site.url}${route}/`,
    lastModified: new Date(),
  }));

  const posts = getAllPosts().map((post) => ({
    url: `${site.url}/blog/${post.slug}/`,
    lastModified: post.date ? new Date(post.date) : new Date(),
  }));

  return [...routes, ...posts];
}
