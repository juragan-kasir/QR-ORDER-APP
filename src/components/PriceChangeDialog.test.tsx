import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PriceChangeDialog from "./PriceChangeDialog";

afterEach(cleanup);

const changes = [
  { name: "Kopi", quantity: 2, expectedPrice: 20000, currentPrice: 25000 },
  { name: "Paket Hemat", quantity: 1, expectedPrice: 50000, currentPrice: 52000 },
];

function renderDialog(overrides = {}) {
  const onConfirm = vi.fn();
  const onDecline = vi.fn();
  render(
    <PriceChangeDialog
      open
      changes={changes}
      confirming={false}
      stale={false}
      onConfirm={onConfirm}
      onDecline={onDecline}
      {...overrides}
    />,
  );
  return { onConfirm, onDecline };
}

describe("PriceChangeDialog — Indonesian confirmation (DR-11)", () => {
  test("renders nothing when closed", () => {
    render(
      <PriceChangeDialog
        open={false}
        changes={changes}
        confirming={false}
        stale={false}
        onConfirm={() => {}}
        onDecline={() => {}}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: "Harga berubah" }),
    ).not.toBeInTheDocument();
  });

  test("explains the price change and lists old versus new unit prices", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: "Harga berubah" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kopi")).toBeInTheDocument();
    expect(screen.getByText(/Rp20[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp25[.,]000/)).toBeInTheDocument();
    expect(screen.getByText("Paket Hemat")).toBeInTheDocument();
  });

  test("confirming an enabled dialog calls back (parent owns dedupe)", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await user.click(
      screen.getByRole("button", { name: /konfirmasi/i }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("a confirming dialog disables its button (parent dedupe)", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ confirming: true });
    const button = screen.getByRole("button", { name: /mengirim/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("decline dismisses without confirming", async () => {
    const user = userEvent.setup();
    const { onConfirm, onDecline } = renderDialog();
    await user.click(screen.getByRole("button", { name: /batal|tutup/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("a stale cart shows a review-again notice instead of confirm", () => {
    renderDialog({ stale: true });
    expect(
      screen.getByText(/keranjang berubah setelah harga diperbarui/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /konfirmasi|setuju|lanjut/i }),
    ).not.toBeInTheDocument();
  });
});
