import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/private/", "/embed/"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
