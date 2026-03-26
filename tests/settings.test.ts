import { describe, it, expect } from "vitest";
import { prisma, SHOP_A, SHOP_B } from "./setup";
import {
  getSetting,
  getSettingBool,
  getSettingInt,
  setSetting,
  setSettings,
  getAllSettings,
  deleteSetting,
  deleteAllSettings,
  seedDefaults,
  SETTING_DEFAULTS,
} from "~/lib/settings.server";

describe("Settings helpers", () => {
  // ── getSetting ────────────────────────────────────────────────────────────

  describe("getSetting", () => {
    it("returns default when no row exists", async () => {
      const val = await getSetting(SHOP_A, "enabled");
      expect(val).toBe("true");
    });

    it("returns stored value when row exists", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "enabled", value: "false" },
      });
      const val = await getSetting(SHOP_A, "enabled");
      expect(val).toBe("false");
    });

    it("returns empty string for unknown key with no default", async () => {
      const val = await getSetting(SHOP_A, "nonexistent_key");
      expect(val).toBe("");
    });

    it("is shop-scoped — different shops get different values", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "rate_limit", value: "10" },
      });
      const valA = await getSetting(SHOP_A, "rate_limit");
      const valB = await getSetting(SHOP_B, "rate_limit");

      expect(valA).toBe("10"); // stored override
      expect(valB).toBe("5"); // default
    });
  });

  // ── getSettingBool ────────────────────────────────────────────────────────

  describe("getSettingBool", () => {
    it("parses 'true' as true", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "debug_mode", value: "true" },
      });
      expect(await getSettingBool(SHOP_A, "debug_mode")).toBe(true);
    });

    it("parses '1' as true", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "debug_mode", value: "1" },
      });
      expect(await getSettingBool(SHOP_A, "debug_mode")).toBe(true);
    });

    it("parses 'false' as false", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "debug_mode", value: "false" },
      });
      expect(await getSettingBool(SHOP_A, "debug_mode")).toBe(false);
    });

    it("uses default when no row exists", async () => {
      // debug_mode default is "false"
      expect(await getSettingBool(SHOP_A, "debug_mode")).toBe(false);
      // enabled default is "true"
      expect(await getSettingBool(SHOP_A, "enabled")).toBe(true);
    });
  });

  // ── getSettingInt ─────────────────────────────────────────────────────────

  describe("getSettingInt", () => {
    it("parses stored numeric value", async () => {
      await prisma.setting.create({
        data: { shop: SHOP_A, key: "retention_days", value: "90" },
      });
      expect(await getSettingInt(SHOP_A, "retention_days")).toBe(90);
    });

    it("returns 0 for non-numeric value", async () => {
      await setSetting(SHOP_A, "retention_days", "abc");
      expect(await getSettingInt(SHOP_A, "retention_days")).toBe(0);
    });

    it("uses default when no row exists", async () => {
      // rate_limit default is "5"
      expect(await getSettingInt(SHOP_A, "rate_limit")).toBe(5);
    });
  });

  // ── setSetting ────────────────────────────────────────────────────────────

  describe("setSetting", () => {
    it("creates a new setting row", async () => {
      await setSetting(SHOP_A, "cookie_duration", "365");
      const val = await getSetting(SHOP_A, "cookie_duration");
      expect(val).toBe("365");
    });

    it("upserts an existing setting row", async () => {
      await setSetting(SHOP_A, "cookie_duration", "30");
      await setSetting(SHOP_A, "cookie_duration", "60");
      const val = await getSetting(SHOP_A, "cookie_duration");
      expect(val).toBe("60");

      // Should have exactly one row, not two
      const count = await prisma.setting.count({
        where: { shop: SHOP_A, key: "cookie_duration" },
      });
      expect(count).toBe(1);
    });
  });

  // ── setSettings (bulk) ────────────────────────────────────────────────────

  describe("setSettings", () => {
    it("sets multiple settings in one transaction", async () => {
      await setSettings(SHOP_A, {
        enabled: "false",
        rate_limit: "20",
        debug_mode: "true",
      });

      expect(await getSetting(SHOP_A, "enabled")).toBe("false");
      expect(await getSetting(SHOP_A, "rate_limit")).toBe("20");
      expect(await getSetting(SHOP_A, "debug_mode")).toBe("true");
    });

    it("does not affect other shops", async () => {
      await setSettings(SHOP_A, { rate_limit: "99" });
      expect(await getSetting(SHOP_B, "rate_limit")).toBe("5"); // default
    });
  });

  // ── getAllSettings ────────────────────────────────────────────────────────

  describe("getAllSettings", () => {
    it("returns defaults when shop has no stored settings", async () => {
      const all = await getAllSettings(SHOP_A);
      expect(all).toEqual(SETTING_DEFAULTS);
    });

    it("merges stored values over defaults", async () => {
      await setSetting(SHOP_A, "rate_limit", "42");
      await setSetting(SHOP_A, "enabled", "false");

      const all = await getAllSettings(SHOP_A);
      expect(all.rate_limit).toBe("42");
      expect(all.enabled).toBe("false");
      // Unset keys still use defaults
      expect(all.cookie_duration).toBe("180");
      expect(all.exclude_bots).toBe("true");
    });

    it("includes custom keys not in defaults", async () => {
      await setSetting(SHOP_A, "custom_key", "custom_value");
      const all = await getAllSettings(SHOP_A);
      expect(all.custom_key).toBe("custom_value");
    });
  });

  // ── deleteSetting ─────────────────────────────────────────────────────────

  describe("deleteSetting", () => {
    it("removes a stored setting (resets to default)", async () => {
      await setSetting(SHOP_A, "rate_limit", "99");
      await deleteSetting(SHOP_A, "rate_limit");

      // Should now return default
      expect(await getSetting(SHOP_A, "rate_limit")).toBe("5");
    });

    it("is safe to call on non-existent key", async () => {
      await expect(
        deleteSetting(SHOP_A, "nonexistent"),
      ).resolves.not.toThrow();
    });

    it("does not affect other shops", async () => {
      await setSetting(SHOP_A, "rate_limit", "10");
      await setSetting(SHOP_B, "rate_limit", "20");

      await deleteSetting(SHOP_A, "rate_limit");

      expect(await getSetting(SHOP_A, "rate_limit")).toBe("5"); // default
      expect(await getSetting(SHOP_B, "rate_limit")).toBe("20"); // untouched
    });
  });

  // ── deleteAllSettings ─────────────────────────────────────────────────────

  describe("deleteAllSettings", () => {
    it("removes all settings for a shop", async () => {
      await setSettings(SHOP_A, { enabled: "false", rate_limit: "10" });
      await setSettings(SHOP_B, { enabled: "true", rate_limit: "20" });

      await deleteAllSettings(SHOP_A);

      expect(await prisma.setting.count({ where: { shop: SHOP_A } })).toBe(0);
      expect(await prisma.setting.count({ where: { shop: SHOP_B } })).toBe(2);
    });
  });

  // ── seedDefaults ──────────────────────────────────────────────────────────

  describe("seedDefaults", () => {
    it("creates all default setting rows for a new shop", async () => {
      await seedDefaults(SHOP_A);

      const count = await prisma.setting.count({ where: { shop: SHOP_A } });
      expect(count).toBe(Object.keys(SETTING_DEFAULTS).length);

      // Verify values match defaults
      const all = await getAllSettings(SHOP_A);
      for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
        expect(all[key]).toBe(value);
      }
    });

    it("does not overwrite existing customised settings", async () => {
      await setSetting(SHOP_A, "rate_limit", "99");
      await seedDefaults(SHOP_A);

      // Custom value should be preserved
      expect(await getSetting(SHOP_A, "rate_limit")).toBe("99");
      // Other defaults should be created
      expect(await getSetting(SHOP_A, "enabled")).toBe("true");
    });

    it("is safe to call multiple times (idempotent)", async () => {
      await seedDefaults(SHOP_A);
      await seedDefaults(SHOP_A);

      const count = await prisma.setting.count({ where: { shop: SHOP_A } });
      expect(count).toBe(Object.keys(SETTING_DEFAULTS).length);
    });
  });
});
