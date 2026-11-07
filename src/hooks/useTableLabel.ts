import { useState } from "react";
import { useFetchEffect } from "./useFetch";
import { fetchTableLabel } from "../services/tableService";

interface TableLabelState {
  label: string | null;
  error: string | null;
}

export function useTableLabel(
  storeId: string | null,
  tableId: string | null,
): { label: string | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<TableLabelState>({
    label: null,
    error: null,
  });
  const { isPending } = useFetchEffect(async (cancelled) => {
    if (!storeId || !tableId) {
      if (!cancelled()) setState({ label: null, error: null });
      return;
    }
    if (!cancelled()) setState({ label: null, error: null });
    try {
      const label = await fetchTableLabel(storeId, tableId);
      if (!cancelled()) setState({ label, error: null });
    } catch (err) {
      if (!cancelled()) {
        setState({
          label: null,
          error: err instanceof Error ? err.message : "Gagal memuat meja",
        });
      }
    }
  }, [storeId, tableId]);

  const loading =
    isPending ||
    (Boolean(storeId && tableId) && !state.label && !state.error);
  return { label: state.label, loading, error: state.error };
}
