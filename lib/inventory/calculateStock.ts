export type StockCalculation = {
  physicalStock: number;
  operationalStock: number;
  installedQuantity: number;
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
  installedQuantity = 0,
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

  const normalizedInstalled =
    Math.max(
      Math.trunc(
        Number(installedQuantity) || 0,
      ),
      0,
    );

  /*
   * quantity contém somente unidades
   * operacionais.
   *
   * installedQuantity contém unidades
   * fisicamente existentes, porém
   * instaladas dentro de máquinas.
   *
   * damagedQuantity contém unidades
   * fisicamente existentes, porém
   * indisponíveis por dano.
   */
  const physicalStock =
    normalizedOperationalStock +
    normalizedInstalled +
    normalizedDamaged;

  /*
   * Quantidade operacional comprometida
   * com projetos ativos.
   *
   * Componentes instalados não entram
   * neste cálculo.
   */
  const inUse = Math.min(
    normalizedOperationalStock,
    normalizedRequested,
  );

  /*
   * Apenas estoque operacional pode
   * atender projetos.
   *
   * installedQuantity nunca aumenta
   * a disponibilidade.
   */
  const availableStock = Math.max(
    normalizedOperationalStock -
      normalizedRequested,
    0,
  );

  /*
   * Déficit calculado somente contra
   * estoque operacional.
   */
  const shortage = Math.max(
    normalizedRequested -
      normalizedOperationalStock,
    0,
  );

  return {
    physicalStock,

    operationalStock:
      normalizedOperationalStock,

    installedQuantity:
      normalizedInstalled,

    requested:
      normalizedRequested,

    inUse,

    availableStock,

    damagedQuantity:
      normalizedDamaged,

    shortage,
  };
}