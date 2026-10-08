import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // ログインの仕組み（/__/）は検索対象にしない
    rules: { userAgent: "*", allow: "/", disallow: "/__/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
