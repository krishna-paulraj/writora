import { Footer } from "@/components/blocks/footer";
import { Navbar } from "@/components/blocks/navbar";

const GITHUB_REPO = "krishna-paulraj/writora";

async function getStargazersCount(repo: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: { stargazers_count?: number } = await res.json();
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stargazersCount = await getStargazersCount(GITHUB_REPO);

  return (
    <>
      <Navbar repo={GITHUB_REPO} stargazersCount={stargazersCount} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
