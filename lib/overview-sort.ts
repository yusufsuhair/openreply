import type { OverviewPost } from "@/app/api/instagram/overview/route";

export const overviewSortColumns = [
  ["caption", "Post"],
  ["views", "Views"],
  ["reach", "Reach"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["saved", "Saved"],
  ["shares", "Shares"],
  ["timestamp", "Date"],
] as const;

export type OverviewSortKey = (typeof overviewSortColumns)[number][0];
export type SortDirection = "ascending" | "descending";

function valueFor(post: OverviewPost, key: OverviewSortKey) {
  return key === "caption" ? post.caption : post[key];
}

export function sortOverviewPosts(
  posts: OverviewPost[],
  key: OverviewSortKey,
  direction: SortDirection,
) {
  return [...posts].sort((left, right) => {
    const a = valueFor(left, key);
    const b = valueFor(right, key);
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    const compared =
      typeof a === "string" && typeof b === "string"
        ? a.localeCompare(b, "en-MY")
        : Number(a) - Number(b);
    return direction === "ascending" ? compared : -compared;
  });
}
