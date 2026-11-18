import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import CategoryIcon from "./CategoryIcon";
import { ICON_MAP, getDynamicIcon } from "./dynamicIcons";

afterEach(cleanup);

describe("CategoryIcon — ikon kategori sama dengan FE-POS (lucide, tanpa font Material Symbols)", () => {
  test("nama ikon dari picker FE-POS dirender sebagai SVG lucide", () => {
    const { container } = render(<CategoryIcon icon="restaurant" size={22} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("22");
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
    expect(container.textContent).toBe("");
  });

  test("nama yang tidak dikenal jatuh ke ikon Folder (sama seperti FE-POS)", () => {
    expect(getDynamicIcon("tidak_ada_ikon")).toBe(ICON_MAP.folder ?? getDynamicIcon(null));
    const { container } = render(<CategoryIcon icon="tidak_ada_ikon" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("emoji tetap ditampilkan sebagai teks dan URL sebagai gambar", () => {
    const emoji = render(<CategoryIcon icon="🍜" />);
    expect(emoji.container.textContent).toBe("🍜");
    const url = render(<CategoryIcon icon="https://cdn.test/kategori.png" />);
    expect(url.container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.test/kategori.png");
  });
});
