export type ModelPresentationSource = {
  vendor?: string | null;
  vendorName?: string | null;
  vendorIcon?: string | null;
  displayGroupID?: number | null;
  displayGroupName?: string | null;
  displayGroupIcon?: string | null;
  upstreamID?: number | null;
  upstreamName?: string | null;
};

export type ResolvedModelPresentationGroup = {
  key: string;
  label: string;
  icon: string;
};

// resolveModelPresentationGroup returns the optional display group when set;
// then falls back to the upstream channel, and finally to the technical-vendor
// grouping if neither override is present.
export function resolveModelPresentationGroup(
  model: ModelPresentationSource,
): ResolvedModelPresentationGroup {
  const displayGroupID = model.displayGroupID ?? 0;
  const displayGroupName = model.displayGroupName?.trim() ?? "";
  if (displayGroupID > 0 && displayGroupName) {
    return {
      key: `group:${displayGroupID}`,
      label: displayGroupName,
      icon: model.displayGroupIcon?.trim() ?? "",
    };
  }

  const upstreamID = model.upstreamID ?? 0;
  const upstreamName = model.upstreamName?.trim() ?? "";
  if (upstreamID > 0 && upstreamName) {
    return {
      key: `upstream:${upstreamID}`,
      label: upstreamName,
      icon: model.vendorIcon?.trim() ?? "",
    };
  }

  const vendorKey = model.vendor?.trim().toLowerCase() || "unknown";
  return {
    key: `vendor:${vendorKey}`,
    label: model.vendorName?.trim() || model.vendor?.trim() || vendorKey,
    icon: model.vendorIcon?.trim() ?? "",
  };
}
