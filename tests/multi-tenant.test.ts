import { describe, it, expect } from "vitest";
import { prisma, SHOP_A, SHOP_B } from "./setup";

describe("Multi-tenant data isolation", () => {
  describe("Visit isolation", () => {
    it("visits are scoped to their shop", async () => {
      // Seed visits for both shops
      await prisma.visit.createMany({
        data: [
          { shop: SHOP_A, source: "google", medium: "cpc", channel: "Paid", landingPage: "/products/a" },
          { shop: SHOP_A, source: "facebook", medium: "social", channel: "Social", landingPage: "/collections/b" },
          { shop: SHOP_B, source: "bing", medium: "organic", channel: "Organic", landingPage: "/pages/about" },
        ],
      });

      const shopAVisits = await prisma.visit.findMany({ where: { shop: SHOP_A } });
      const shopBVisits = await prisma.visit.findMany({ where: { shop: SHOP_B } });

      expect(shopAVisits).toHaveLength(2);
      expect(shopBVisits).toHaveLength(1);

      // Verify no cross-contamination
      expect(shopAVisits.every((v) => v.shop === SHOP_A)).toBe(true);
      expect(shopBVisits.every((v) => v.shop === SHOP_B)).toBe(true);

      // Verify data integrity
      expect(shopAVisits.map((v) => v.source).sort()).toEqual(["facebook", "google"]);
      expect(shopBVisits[0].source).toBe("bing");
    });

    it("deleting one shop's visits does not affect another shop", async () => {
      await prisma.visit.createMany({
        data: [
          { shop: SHOP_A, source: "google", channel: "Organic" },
          { shop: SHOP_B, source: "bing", channel: "Organic" },
        ],
      });

      await prisma.visit.deleteMany({ where: { shop: SHOP_A } });

      const shopAVisits = await prisma.visit.findMany({ where: { shop: SHOP_A } });
      const shopBVisits = await prisma.visit.findMany({ where: { shop: SHOP_B } });

      expect(shopAVisits).toHaveLength(0);
      expect(shopBVisits).toHaveLength(1);
      expect(shopBVisits[0].source).toBe("bing");
    });
  });

  describe("Campaign isolation", () => {
    it("campaigns are scoped to their shop", async () => {
      await prisma.campaign.create({
        data: { shop: SHOP_A, name: "Summer Sale", slug: "summer-sale", source: "google", medium: "cpc", campaign: "summer_2026" },
      });
      await prisma.campaign.create({
        data: { shop: SHOP_B, name: "Winter Promo", slug: "winter-promo", source: "facebook", medium: "paid", campaign: "winter_2026" },
      });

      const shopACampaigns = await prisma.campaign.findMany({ where: { shop: SHOP_A } });
      const shopBCampaigns = await prisma.campaign.findMany({ where: { shop: SHOP_B } });

      expect(shopACampaigns).toHaveLength(1);
      expect(shopACampaigns[0].name).toBe("Summer Sale");
      expect(shopBCampaigns).toHaveLength(1);
      expect(shopBCampaigns[0].name).toBe("Winter Promo");
    });

    it("unique slug constraint is per-shop, not global", async () => {
      // Both shops can use the same slug
      await prisma.campaign.create({
        data: { shop: SHOP_A, name: "Campaign A", slug: "same-slug", source: "google", medium: "cpc", campaign: "test" },
      });
      await prisma.campaign.create({
        data: { shop: SHOP_B, name: "Campaign B", slug: "same-slug", source: "facebook", medium: "cpc", campaign: "test" },
      });

      const allWithSlug = await prisma.campaign.findMany({
        where: { slug: "same-slug" },
      });
      expect(allWithSlug).toHaveLength(2);

      // But same shop + same slug should fail
      await expect(
        prisma.campaign.create({
          data: { shop: SHOP_A, name: "Duplicate", slug: "same-slug", source: "x", medium: "y", campaign: "z" },
        }),
      ).rejects.toThrow();
    });

    it("deleting one shop's campaigns does not affect another shop", async () => {
      await prisma.campaign.create({
        data: { shop: SHOP_A, name: "A Campaign", slug: "a-campaign", source: "google", medium: "cpc", campaign: "a" },
      });
      await prisma.campaign.create({
        data: { shop: SHOP_B, name: "B Campaign", slug: "b-campaign", source: "bing", medium: "cpc", campaign: "b" },
      });

      await prisma.campaign.deleteMany({ where: { shop: SHOP_A } });

      expect(await prisma.campaign.count({ where: { shop: SHOP_A } })).toBe(0);
      expect(await prisma.campaign.count({ where: { shop: SHOP_B } })).toBe(1);
    });
  });

  describe("Setting isolation", () => {
    it("settings are scoped to their shop", async () => {
      await prisma.setting.create({ data: { shop: SHOP_A, key: "retention_days", value: "90" } });
      await prisma.setting.create({ data: { shop: SHOP_B, key: "retention_days", value: "30" } });

      const shopASetting = await prisma.setting.findUnique({
        where: { shop_key: { shop: SHOP_A, key: "retention_days" } },
      });
      const shopBSetting = await prisma.setting.findUnique({
        where: { shop_key: { shop: SHOP_B, key: "retention_days" } },
      });

      expect(shopASetting?.value).toBe("90");
      expect(shopBSetting?.value).toBe("30");
    });

    it("unique key constraint is per-shop, not global", async () => {
      await prisma.setting.create({ data: { shop: SHOP_A, key: "debug_mode", value: "true" } });
      await prisma.setting.create({ data: { shop: SHOP_B, key: "debug_mode", value: "false" } });

      // Same shop + same key should fail
      await expect(
        prisma.setting.create({ data: { shop: SHOP_A, key: "debug_mode", value: "false" } }),
      ).rejects.toThrow();
    });
  });

  describe("Session isolation", () => {
    it("sessions are scoped to their shop", async () => {
      await prisma.session.create({
        data: { id: "offline_shop-a-test", shop: SHOP_A, state: "active", accessToken: "shpat_a_token_123" },
      });
      await prisma.session.create({
        data: { id: "offline_shop-b-test", shop: SHOP_B, state: "active", accessToken: "shpat_b_token_456" },
      });

      const shopASessions = await prisma.session.findMany({ where: { shop: SHOP_A } });
      const shopBSessions = await prisma.session.findMany({ where: { shop: SHOP_B } });

      expect(shopASessions).toHaveLength(1);
      expect(shopASessions[0].accessToken).toBe("shpat_a_token_123");
      expect(shopBSessions).toHaveLength(1);
      expect(shopBSessions[0].accessToken).toBe("shpat_b_token_456");
    });
  });
});

describe("Uninstall data cleanup", () => {
  it("deletes all data for a shop when uninstalled, leaving other shops intact", async () => {
    // Seed data for both shops — simulating two active installations
    await prisma.session.create({
      data: { id: "offline_shop-a", shop: SHOP_A, state: "active", accessToken: "shpat_aaa" },
    });
    await prisma.session.create({
      data: { id: "offline_shop-b", shop: SHOP_B, state: "active", accessToken: "shpat_bbb" },
    });

    await prisma.visit.createMany({
      data: [
        { shop: SHOP_A, source: "google", channel: "Paid" },
        { shop: SHOP_A, source: "direct", channel: "Direct" },
        { shop: SHOP_B, source: "facebook", channel: "Social" },
      ],
    });

    await prisma.campaign.create({
      data: { shop: SHOP_A, name: "A Campaign", slug: "a-camp", source: "g", medium: "c", campaign: "a" },
    });
    await prisma.campaign.create({
      data: { shop: SHOP_B, name: "B Campaign", slug: "b-camp", source: "f", medium: "s", campaign: "b" },
    });

    await prisma.setting.create({ data: { shop: SHOP_A, key: "tracking_enabled", value: "true" } });
    await prisma.setting.create({ data: { shop: SHOP_B, key: "tracking_enabled", value: "true" } });

    // Simulate uninstall for Shop A — mirrors the webhook handler logic
    await Promise.all([
      prisma.visit.deleteMany({ where: { shop: SHOP_A } }),
      prisma.campaign.deleteMany({ where: { shop: SHOP_A } }),
      prisma.setting.deleteMany({ where: { shop: SHOP_A } }),
      prisma.session.deleteMany({ where: { shop: SHOP_A } }),
    ]);

    // Shop A should have zero data
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(0);
    expect(await prisma.visit.count({ where: { shop: SHOP_A } })).toBe(0);
    expect(await prisma.campaign.count({ where: { shop: SHOP_A } })).toBe(0);
    expect(await prisma.setting.count({ where: { shop: SHOP_A } })).toBe(0);

    // Shop B should be completely untouched
    expect(await prisma.session.count({ where: { shop: SHOP_B } })).toBe(1);
    expect(await prisma.visit.count({ where: { shop: SHOP_B } })).toBe(1);
    expect(await prisma.campaign.count({ where: { shop: SHOP_B } })).toBe(1);
    expect(await prisma.setting.count({ where: { shop: SHOP_B } })).toBe(1);
  });

  it("handles uninstall when shop has no data (idempotent)", async () => {
    // No data exists for Shop A — uninstall should not throw
    await expect(
      Promise.all([
        prisma.visit.deleteMany({ where: { shop: SHOP_A } }),
        prisma.campaign.deleteMany({ where: { shop: SHOP_A } }),
        prisma.setting.deleteMany({ where: { shop: SHOP_A } }),
        prisma.session.deleteMany({ where: { shop: SHOP_A } }),
      ]),
    ).resolves.not.toThrow();
  });

  it("handles double uninstall (webhook fires twice)", async () => {
    // Seed and delete once
    await prisma.session.create({
      data: { id: "offline_double", shop: SHOP_A, state: "active", accessToken: "shpat_double" },
    });
    await prisma.visit.create({ data: { shop: SHOP_A, source: "test", channel: "Test" } });

    await Promise.all([
      prisma.visit.deleteMany({ where: { shop: SHOP_A } }),
      prisma.campaign.deleteMany({ where: { shop: SHOP_A } }),
      prisma.setting.deleteMany({ where: { shop: SHOP_A } }),
      prisma.session.deleteMany({ where: { shop: SHOP_A } }),
    ]);

    // Second uninstall should not throw
    await expect(
      Promise.all([
        prisma.visit.deleteMany({ where: { shop: SHOP_A } }),
        prisma.campaign.deleteMany({ where: { shop: SHOP_A } }),
        prisma.setting.deleteMany({ where: { shop: SHOP_A } }),
        prisma.session.deleteMany({ where: { shop: SHOP_A } }),
      ]),
    ).resolves.not.toThrow();
  });
});
