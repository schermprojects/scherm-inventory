export type StockCalculation = {
  physicalStock: number;
  requested: number;
  inUse: number;
  availableStock: number;
  shortage: number;
};

export function calculateStock(
  physicalStock: number,
  requested: number,
): StockCalculation {
  const normalizedPhysicalStock = Math.max(
    Number(physicalStock) || 0,
    0,
  );

  const normalizedRequested = Math.max(
    Number(requested) || 0,
    0,
  );

  const inUse = Math.min(
    normalizedPhysicalStock,
    normalizedRequested,
  );

  const availableStock = Math.max(
    normalizedPhysicalStock - inUse,
    0,
  );

  const shortage = Math.max(
    normalizedRequested - normalizedPhysicalStock,
    0,
  );

  return {
    physicalStock: normalizedPhysicalStock,
    requested: normalizedRequested,
    inUse,
    availableStock,
    shortage,
  };
}