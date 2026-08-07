export type StockCalculation = {
  physicalStock: number;
  operationalStock: number;
  requested: number;
  inUse: number;
  availableStock: number;
  damagedQuantity: number;
  shortage: number;
};

export function calculateStock(
  operationalStock: number,
  requested: number,
  damagedQuantity = 0,
): StockCalculation {
  const normalizedOperationalStock =
    Math.max(
      Math.trunc(
        Number(operationalStock) || 0,
      ),
      0,
    );

  const normalizedRequested =
    Math.max(
      Math.trunc(
        Number(requested) || 0,
      ),
      0,
    );

  const normalizedDamaged =
    Math.max(
      Math.trunc(
        Number(damagedQuantity) || 0,
      ),
      0,
    );

  /*
   * quantity contém somente unidades
   * operacionais.
   *
   * damagedQuantity contém unidades
   * fisicamente existentes, porém
   * indisponíveis para utilização.
   */
  const physicalStock =
    normalizedOperationalStock +
    normalizedDamaged;

  /*
   * Quantidade operacional comprometida
   * com projetos ativos.
   */
  const inUse = Math.min(
    normalizedOperationalStock,
    normalizedRequested,
  );

  /*
   * Apenas estoque operacional pode
   * atender projetos.
   */
  const availableStock = Math.max(
    normalizedOperationalStock -
      normalizedRequested,
    0,
  );

  const shortage = Math.max(
    normalizedRequested -
      normalizedOperationalStock,
    0,
  );

  return {
    physicalStock,
    operationalStock:
      normalizedOperationalStock,
    requested: normalizedRequested,
    inUse,
    availableStock,
    damagedQuantity:
      normalizedDamaged,
    shortage,
  };
}