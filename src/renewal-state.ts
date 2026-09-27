const managedRenewals = new Map<string, number>();

export const beginManagedRenewal = (identity: string): (() => void) => {
  managedRenewals.set(identity, (managedRenewals.get(identity) ?? 0) + 1);
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    const active = managedRenewals.get(identity) ?? 0;
    if (active <= 1) managedRenewals.delete(identity);
    else managedRenewals.set(identity, active - 1);
  };
};

export const hasManagedRenewal = (identity: string): boolean => (managedRenewals.get(identity) ?? 0) > 0;
