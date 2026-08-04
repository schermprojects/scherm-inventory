export const LOW_STOCK_THRESHOLD = 3;

export type StockAlertLevel =
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "NORMAL";

export function getStockAlertLevel(
  availableStock: number,
): StockAlertLevel {
  const normalizedAvailableStock = Math.max(
    Number(availableStock) || 0,
    0,
  );

  if (normalizedAvailableStock === 0) {
    return "OUT_OF_STOCK";
  }

  if (
    normalizedAvailableStock <=
    LOW_STOCK_THRESHOLD
  ) {
    return "LOW_STOCK";
  }

  return "NORMAL";
}

export function isOutOfStock(
  availableStock: number,
): boolean {
  return (
    getStockAlertLevel(availableStock) ===
    "OUT_OF_STOCK"
  );
}

export function isLowStock(
  availableStock: number,
): boolean {
  return (
    getStockAlertLevel(availableStock) ===
    "LOW_STOCK"
  );
}