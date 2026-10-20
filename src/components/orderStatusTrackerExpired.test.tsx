import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrderStatusTracker from "./OrderStatusTracker";

afterEach(cleanup);

// DR-09: a system-expired order explains itself instead of blaming the cashier.
describe("OrderStatusTracker — expired order", () => {
  test("Kedaluwarsa shows the expiry explanation, not a rejection", () => {
    render(<OrderStatusTracker currentStatus="Kedaluwarsa" />);
    expect(screen.getByText("Pesanan Kedaluwarsa")).toBeTruthy();
    expect(screen.getByText(/tidak dibayar dalam batas waktu/)).toBeTruthy();
    expect(screen.queryByText("Pesanan Ditolak")).toBeNull();
  });

  test("Ditolak still reads as a rejection", () => {
    render(<OrderStatusTracker currentStatus="Ditolak" />);
    expect(screen.getByText("Pesanan Ditolak")).toBeTruthy();
  });
});
