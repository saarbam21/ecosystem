import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getAllPosts, formatDate } from "@/lib/posts";

export const metadata = {
  title: "בלוג",
  description:
    "מאמרים על תכנון פיננסי, פנסיה, השקעות וחשיבה ארוכת-טווח על הכסף שלכם.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <PageHeader
        eyebrow="בלוג"
        title="מחשבות על כסף, השקעות ופנסיה"
        subtitle="מאמרים בשפה פשוטה שיעזרו לכם להבין טוב יותר את התמונה הפיננסית שלכם."
      />

      <section className="section">
        <div className="container-page">
          {posts.length === 0 ? (
            <p className="text-center text-ink-soft">בקרוב יתפרסמו כאן מאמרים.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}/`}
                  className="card group flex flex-col transition hover:-translate-y-1"
                >
                  <p className="text-sm text-ink-soft">{formatDate(post.date)}</p>
                  <h2 className="mt-2 text-xl font-bold text-ink group-hover:text-brand-700">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-ink-soft">{post.excerpt}</p>
                  <span className="mt-4 font-semibold text-brand-700">
                    קריאת המאמר ←
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
