import Link from "next/link";
import { notFound } from "next/navigation";
import CTA from "@/components/CTA";
import { getPostSlugs, getPostBySlug, formatDate } from "@/lib/posts";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: { title: post.title, description: post.excerpt, type: "article" },
    };
  } catch {
    return { title: "מאמר" };
  }
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    notFound();
  }

  return (
    <>
      <article>
        <header className="bg-gradient-to-b from-brand-50 to-white">
          <div className="container-page mx-auto max-w-3xl py-16 text-center sm:py-20">
            <Link href="/blog/" className="text-sm font-semibold text-brand-700 hover:underline">
              ← חזרה לבלוג
            </Link>
            <h1 className="mt-4 text-3xl font-extrabold text-ink sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 text-ink-soft">
              {post.author && <span>{post.author} · </span>}
              {formatDate(post.date)}
            </p>
          </div>
        </header>

        <div className="container-page py-12">
          <div
            className="prose-he mx-auto max-w-3xl"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </div>
      </article>

      <CTA />
    </>
  );
}
