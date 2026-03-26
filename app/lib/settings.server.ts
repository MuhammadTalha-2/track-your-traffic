/**
 * Settings helper — typed get/set/getAll/delete for per-shop tyt_settings rows.
 *
 * Mirrors the WordPress AdminDashboard::get_setting() pattern but uses
 * individual key-value rows (one per setting per shop) instead of a
 * serialised option blob.
 */

import prisma from "~/db.server";

// ── Default values (matches WordPress AdminDashboard::get_defaults) ─────────

export const SETTING_DEFAULTS: Record<string, string> = {
  enabled: "true",
  cookie_duration: "180", // days
  cookie_domain: "",
  debug_mode: "false",
  excluded_ips: "",
  exclude_admins: "true",
  exclude_bots: "true",
  custom_bot_patterns: "",
  retention_days: "0", // 0 = keep forever
  rate_limit: "5", // requests per minute per IP
};

/** All recognised setting keys. */
export type SettingKey = keyof typeof SETTING_DEFAULTS;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get a single setting value for a shop.
 * Returns the stored value or the built-in default.
 */
export async function getSetting(
  shop: string,
  key: string,
): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { shop_key: { shop, key } },
  });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

/**
 * Get a setting and parse it as a boolean.
 * "true" / "1" → true, everything else → false.
 */
export async function getSettingBool(
  shop: string,
  key: string,
): Promise<boolean> {
  const val = await getSetting(shop, key);
  return val === "true" || val === "1";
}

/**
 * Get a setting and parse it as an integer.
 * Falls back to 0 if not a valid number.
 */
export async function getSettingInt(
  shop: string,
  key: string,
): Promise<number> {
  const val = await getSetting(shop, key);
  const num = parseInt(val, 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Set (upsert) a single setting for a shop.
 */
export async function setSetting(
  shop: string,
  key: string,
  value: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: { shop_key: { shop, key } },
    update: { value },
    create: { shop, key, value },
  });
}

/**
 * Set multiple settings at once for a shop (transactional).
 */
export async function setSettings(
  shop: string,
  settings: Record<string, string>,
): Promise<void> {
  const ops = Object.entries(settings).map(([key, value]) =>
    prisma.setting.upsert({
      where: { shop_key: { shop, key } },
      update: { value },
      create: { shop, key, value },
    }),
  );
  await prisma.$transaction(ops);
}

/**
 * Get all settings for a shop, merged with defaults.
 * Keys that have no stored row use the built-in default.
 */
export async function getAllSettings(
  shop: string,
): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { shop } });

  const merged = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  return merged;
}

/**
 * Delete a single setting for a shop (resets it to default).
 */
export async function deleteSetting(
  shop: string,
  key: string,
): Promise<void> {
  await prisma.setting.deleteMany({ where: { shop, key } });
}

/**
 * Delete ALL settings for a shop (used on uninstall).
 */
export async function deleteAllSettings(shop: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { shop } });
}

/**
 * Seed default settings for a newly installed shop.
 * Only creates rows that don't already exist (safe to call multiple times).
 */
export async function seedDefaults(shop: string): Promise<void> {
  const ops = Object.entries(SETTING_DEFAULTS).map(([key, value]) =>
    prisma.setting.upsert({
      where: { shop_key: { shop, key } },
      update: {}, // no-op if already exists
      create: { shop, key, value },
    }),
  );
  await prisma.$transaction(ops);
}
