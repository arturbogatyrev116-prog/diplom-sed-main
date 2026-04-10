import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { getDashboardTiles } from "@/server/policies/dashboard";

describe("dashboard policy", () => {
  it("EMPLOYEE видит только документы, входящие, исходящие, поиск", () => {
    const tiles = getDashboardTiles(UserRole.EMPLOYEE);
    const hrefs = tiles.map((t) => t.href);
    expect(hrefs).toEqual(["/documents", "/inbox", "/outbox", "/search"]);
  });

  it("MANAGER видит только документы, входящие, исходящие, поиск", () => {
    const tiles = getDashboardTiles(UserRole.MANAGER);
    const hrefs = tiles.map((t) => t.href);
    expect(hrefs).toEqual(["/documents", "/inbox", "/outbox", "/search"]);
  });

  it("OWNER видит документы, входящие, на подпись, исходящие, архив, поиск", () => {
    const tiles = getDashboardTiles(UserRole.OWNER);
    const hrefs = tiles.map((t) => t.href);
    expect(hrefs).toEqual([
      "/documents",
      "/inbox",
      "/pending-sign",
      "/outbox",
      "/archive",
      "/search",
    ]);
  });

  it("ADMIN видит архив, поиск, аудит", () => {
    const tiles = getDashboardTiles(UserRole.ADMIN);
    const hrefs = tiles.map((t) => t.href);
    expect(hrefs).toEqual(["/archive", "/search", "/audit"]);
  });

  it("null role возвращает пустой список", () => {
    expect(getDashboardTiles(null)).toEqual([]);
  });
});
