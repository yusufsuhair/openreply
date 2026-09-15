import { expect, it } from "vitest";
import { sortOverviewPosts } from "../lib/overview-sort";

it("sorts metrics while keeping unavailable insights at the end", () => {
  const posts = [
    { id: "one", caption: "One", views: null },
    { id: "two", caption: "Two", views: 10 },
    { id: "three", caption: "Three", views: 30 },
  ] as never;

  expect(sortOverviewPosts(posts, "views", "descending").map((post) => post.id)).toEqual([
    "three",
    "two",
    "one",
  ]);
});
