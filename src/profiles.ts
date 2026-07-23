export const TOOL_PROFILES = [
  "readonly",
  "creator",
  "automation",
  "developer",
] as const;

export type ToolProfile = (typeof TOOL_PROFILES)[number];

export const DEFAULT_TOOL_PROFILE: ToolProfile = "creator";

const READONLY_FACADE_TOOLS = new Set([
  "get_media",
  "list_media",
  "get_account",
]);

const APPROVAL_FACADE_TOOLS = new Set([
  "create_media",
  "revise_media",
  "render_media",
  ...READONLY_FACADE_TOOLS,
]);

const CREATOR_TOOLS = new Set([
  ...APPROVAL_FACADE_TOOLS,
  "get_project_schema",
  "validate_project_json",
  "list_supported_elements",
  "get_element_docs",
  "get_example_payload",
  "plan_creative_video",
  "find_matching_examples",
  "start_from_example",
  "search_creative_library",
  "get_creative_asset",
  "list_stock_providers",
  "search_stock_media",
  "repair_project_json",
  "get_render",
  "list_renders",
  "list_templates",
  "get_template",
  "create_template",
  "duplicate_template",
  "preview_template",
  "list_projects",
  "get_project",
  "create_project",
  "get_credits",
  "get_usage_stats",
]);

const AUTOMATION_TOOLS = new Set([
  ...CREATOR_TOOLS,
  "create_render",
  "create_image_render",
  "render_from_example",
  "create_bulk_render",
  "get_bulk_render",
  "list_bulk_renders",
  "list_webhooks",
  "create_webhook",
  "get_webhook",
  "test_webhook",
  "list_webhook_deliveries",
]);

export function parseToolProfile(
  value: string | undefined,
  fallback: ToolProfile = DEFAULT_TOOL_PROFILE,
): ToolProfile {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  // Saved Advanced selections now use the promoted Creator profile.
  if (normalized === "advanced") return "creator";
  return (TOOL_PROFILES as readonly string[]).includes(normalized)
    ? (normalized as ToolProfile)
    : fallback;
}

export function isToolProfile(value: unknown): value is ToolProfile {
  return (
    typeof value === "string" &&
    (TOOL_PROFILES as readonly string[]).includes(value)
  );
}

export function resolveToolProfile(value: unknown): ToolProfile | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "advanced") return "creator";
  return isToolProfile(normalized) ? normalized : undefined;
}

export function isToolEnabled(profile: ToolProfile, name: string): boolean {
  if (profile === "developer") return true;
  if (profile === "automation") return AUTOMATION_TOOLS.has(name);
  if (profile === "creator") return CREATOR_TOOLS.has(name);
  return READONLY_FACADE_TOOLS.has(name);
}

export function toolsForProfile(
  profile: ToolProfile,
  allToolNames: readonly string[],
): string[] {
  return allToolNames.filter((name) => isToolEnabled(profile, name));
}
