import { expect, it } from "vitest";
import { originPeriodStart } from "./admin";

const NOW = Date.parse("2026-11-14T10:39:00.000Z");

it("uses exactly seven days for the short origin report", () => {
  expect(originPeriodStart("7", NOW)).toBe("2026-11-07T10:39:00.000Z");
});

it("uses exactly thirty days for the default origin report", () => {
  expect(originPeriodStart("30", NOW)).toBe("2026-10-15T10:39:00.000Z");
});

it("starts the launch report on 09/11/2026", () => {
  expect(originPeriodStart("lancamento", NOW)).toBe("2026-11-09T00:00:00-03:00");
});
