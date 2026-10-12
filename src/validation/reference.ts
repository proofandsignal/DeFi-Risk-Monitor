export interface HealthFactorReference {
  referenceHealthFactor: number | null;
  absoluteDelta: number | null;
  relativeDeltaPct: number | null;
  matchesWithinTolerance: boolean | null;
}

export function compareHealthFactorReference(
  totalCollateralBase: number,
  totalDebtBase: number,
  currentLiquidationThreshold: number,
  engineHealthFactor: number | null,
  relativeTolerancePct = 0.1,
): HealthFactorReference {
  if (totalDebtBase <= 0) {
    return {
      referenceHealthFactor: null,
      absoluteDelta: engineHealthFactor === null ? 0 : null,
      relativeDeltaPct: engineHealthFactor === null ? 0 : null,
      matchesWithinTolerance: engineHealthFactor === null,
    };
  }

  if (
    engineHealthFactor === null ||
    !Number.isFinite(totalCollateralBase) ||
    !Number.isFinite(totalDebtBase) ||
    !Number.isFinite(currentLiquidationThreshold) ||
    !Number.isFinite(engineHealthFactor)
  ) {
    return {
      referenceHealthFactor: null,
      absoluteDelta: null,
      relativeDeltaPct: null,
      matchesWithinTolerance: false,
    };
  }

  const referenceHealthFactor =
    (totalCollateralBase * currentLiquidationThreshold) / totalDebtBase;
  const absoluteDelta = Math.abs(engineHealthFactor - referenceHealthFactor);
  const relativeDeltaPct =
    referenceHealthFactor === 0
      ? absoluteDelta === 0
        ? 0
        : Number.POSITIVE_INFINITY
      : (absoluteDelta / Math.abs(referenceHealthFactor)) * 100;

  return {
    referenceHealthFactor,
    absoluteDelta,
    relativeDeltaPct,
    matchesWithinTolerance: relativeDeltaPct <= relativeTolerancePct,
  };
}
