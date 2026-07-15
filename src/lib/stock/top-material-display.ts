import type {
  TopMaterialHomeRow,
  TopMaterialWarehouseQuantity,
} from "@/lib/stock/top-material-types";

export type WarehouseFilter = "all" | string;

export function resolveTopMaterialQuantityView(
  row: TopMaterialHomeRow,
  warehouseFilter: WarehouseFilter,
): {
  quantity: string | null;
  hasBaseline: boolean;
  isShortage: boolean;
} {
  if (!row.found) {
    return { quantity: null, hasBaseline: false, isShortage: false };
  }

  if (warehouseFilter === "all") {
    const baselined = row.warehouses.filter((warehouse) => warehouse.hasBaseline);
    if (baselined.length === 0) {
      return { quantity: null, hasBaseline: false, isShortage: false };
    }

    const total = row.warehouses.reduce(
      (sum, warehouse) => sum + Number(warehouse.quantity ?? 0),
      0,
    );

    return {
      quantity: String(total),
      hasBaseline: true,
      isShortage: total <= 0,
    };
  }

  const warehouse = row.warehouses.find(
    (entry) => entry.warehouseId === warehouseFilter,
  );
  if (!warehouse?.hasBaseline) {
    return { quantity: null, hasBaseline: false, isShortage: false };
  }

  const quantity = warehouse.quantity ?? "0";
  return {
    quantity,
    hasBaseline: true,
    isShortage: Number(quantity) <= 0,
  };
}

export function sumTopMaterialQuantities(
  warehouses: TopMaterialWarehouseQuantity[],
): number {
  return warehouses.reduce(
    (sum, warehouse) => sum + Number(warehouse.quantity ?? 0),
    0,
  );
}
