import { describe, expect, it } from "vitest";
import { canSee, collectViews, viewFile, visibleViews } from "../app/views.ts";

describe("custom admin views", () => {
  const views = collectViews([
    { name: "booking-core", adminViews: [{ id: "bookings", label: "Bookings", minRole: "editor" }] },
    { name: "x", adminViews: [{ id: "settings-x", label: "X settings", minRole: "admin" }] },
    { name: "menu" },
  ]);
  it("collects views with their module", () => {
    expect(views).toEqual([
      { id: "bookings", label: "Bookings", minRole: "editor", module: "booking-core" },
      { id: "settings-x", label: "X settings", minRole: "admin", module: "x" },
    ]);
    expect(viewFile(views[0]!)).toBe("/src/modules/booking-core/admin/bookings.tsx");
  });
  it("gates by role (D16)", () => {
    expect(visibleViews(views, "admin").map((v) => v.id)).toEqual(["bookings", "settings-x"]);
    expect(visibleViews(views, "editor").map((v) => v.id)).toEqual(["bookings"]);
    expect(visibleViews(views, "demo")).toEqual([]);
    expect(visibleViews(views, "")).toEqual([]);
    expect(canSee("editor", "admin")).toBe(false);
  });
  it("fails on duplicate or malformed ids", () => {
    expect(() => collectViews([{ name: "a", adminViews: [{ id: "v", label: "V", minRole: "editor" }] }, { name: "b", adminViews: [{ id: "v", label: "V", minRole: "editor" }] }])).toThrow(/declared twice/);
    expect(() => collectViews([{ name: "a", adminViews: [{ id: "../x", label: "V", minRole: "editor" }] }])).toThrow(/lowercase/);
  });
});
