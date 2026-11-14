import { beforeEach, expect, it } from "vitest";
import { captureSignupOrigin, getSignupOriginMetadata, SIGNUP_ORIGIN_KEY } from "./origin";

const NOW = Date.parse("2026-11-14T10:39:00.000Z");

beforeEach(() => localStorage.clear());

it("captures UTM and ref with their capture date", () => {
  captureSignupOrigin("?utm_source=instagram&utm_campaign=aquecimento&ref=bio", NOW);
  expect(JSON.parse(localStorage.getItem(SIGNUP_ORIGIN_KEY)!)).toEqual({
    utm_source: "instagram",
    utm_campaign: "aquecimento",
    ref: "bio",
    captured_at: "2026-11-14T10:39:00.000Z",
  });
});

it("does not overwrite an origin captured within 30 days", () => {
  captureSignupOrigin("?utm_source=instagram", NOW - 29 * 86400000);
  captureSignupOrigin("?utm_source=google", NOW);
  expect(getSignupOriginMetadata(NOW).utm_source).toBe("instagram");
});

it("replaces an origin after exactly 30 days", () => {
  captureSignupOrigin("?utm_source=instagram", NOW - 30 * 86400000);
  captureSignupOrigin("?utm_source=google", NOW);
  expect(getSignupOriginMetadata(NOW).utm_source).toBe("google");
});

it("does not create an origin without campaign parameters", () => {
  captureSignupOrigin("?pagina=1", NOW);
  expect(localStorage.getItem(SIGNUP_ORIGIN_KEY)).toBeNull();
  expect(getSignupOriginMetadata(NOW)).toEqual({ utm_source: null, utm_campaign: null, ref: null });
});
