import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import CustomizationPanel from "./CustomizationPanel";
import LengthCounter from "./LengthCounter";
import { FIELD_LIMITS, limitBorder } from "../utils/fieldLimits";
import type { Product } from "../types";

// Field-length standard (BA DR-28): a limited field shows "n/max"; at the
// maximum it stops taking characters, its border turns red and a line says
// "Sudah mencapai batas maksimal".

afterEach(cleanup);

const product = {
  id: "1",
  name: "Bakso Urat",
  description: "",
  price: 15000,
  image: "",
  images: [],
  category: "makanan",
  rating: 0,
  reviewsCount: 0,
  isBestSeller: false,
  isPromo: false,
  isVegetarian: false,
  estimatedTime: 3,
  stock: 10,
  storeId: "1",
} as unknown as Product;

const Panel = ({ initial = "" }: { initial?: string }) => {
  const [notes, setNotes] = useState(initial);
  return (
    <CustomizationPanel
      product={product}
      selectedSize={undefined}
      selectedSpiciness={undefined}
      selectedAddOns={[]}
      selectedOptionChoices={{}}
      notes={notes}
      onSizeChange={vi.fn()}
      onSpicinessChange={vi.fn()}
      onAddOnToggle={vi.fn()}
      onOptionChoiceChange={vi.fn()}
      onNotesChange={setNotes}
    />
  );
};

describe("LengthCounter (DR-28)", () => {
  test("shows the count and the maximum; the limit line only at the maximum", () => {
    const { rerender } = render(<LengthCounter id="c" length={3} max={5} />);
    expect(screen.getByText("3/5")).toHaveClass("text-gray-400");
    expect(screen.getByText("Sudah mencapai batas maksimal")).toHaveClass("invisible");
    rerender(<LengthCounter id="c" length={5} max={5} />);
    expect(screen.getByText("5/5")).toHaveClass("text-red-500");
    expect(screen.getByText("Sudah mencapai batas maksimal")).not.toHaveClass("invisible");
  });

  test("limitBorder keeps the field's own border until the maximum", () => {
    expect(limitBorder("abc", 5, "border-gray-200")).toBe("border-gray-200");
    expect(limitBorder("abcde", 5, "border-gray-200")).toContain("border-red-500");
  });

  test("the limits follow the BA DR-28 standard", () => {
    expect(FIELD_LIMITS).toEqual({ PERSON_NAME: 100, SHORT_NOTE: 140, DESCRIPTION: 255 });
  });
});

describe("item notes (Catatan Khusus)", () => {
  test("count while typing, stop at 255, red at the limit", async () => {
    render(<Panel initial={"a".repeat(253)} />);
    const notes = screen.getByPlaceholderText(/tanpa bawang/);
    expect(notes).toHaveAttribute("maxLength", "255");
    expect(screen.getByText("253/255")).toBeInTheDocument();
    expect(notes).not.toHaveClass("border-red-500");

    await userEvent.type(notes, "bcdef");
    expect(notes).toHaveValue("a".repeat(253) + "bc");
    expect(screen.getByText("255/255")).toBeInTheDocument();
    expect(notes).toHaveClass("border-red-500");
    expect(screen.getByText("Sudah mencapai batas maksimal")).not.toHaveClass("invisible");
    expect(notes.getAttribute("aria-describedby")).toBe(
      screen.getByText("255/255").parentElement?.id,
    );
  });
});
