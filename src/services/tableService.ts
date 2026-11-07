import apiClient, { ApiError } from "./apiClient";

interface CustomerTableResponse {
  success?: boolean;
  data?: { id: number; name: string };
}

export async function fetchTableLabel(
  storeId: string,
  tableId: string,
): Promise<string> {
  try {
    const { data } = await apiClient.get<CustomerTableResponse>(
      "/order/customer-table",
      { params: { store: storeId, tableId } },
    );
    const name = data?.data?.name;
    if (typeof name !== "string" || !name.trim()) {
      throw new ApiError("Label meja tidak tersedia.", 0);
    }
    return name;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Gagal memuat meja. Coba lagi nanti.", 0);
  }
}
