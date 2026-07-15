export type TopMaterialWarehouseQuantity = {
  warehouseId: string;
  warehouseName: string;
  quantity: string | null;
  hasBaseline: boolean;
};

export type TopMaterialHomeRow = {
  code: string;
  materialId: string | null;
  materialName: string | null;
  unit: string | null;
  found: boolean;
  warehouses: TopMaterialWarehouseQuantity[];
};

export type TopMaterialWarehouseOption = {
  id: string;
  name: string;
};
