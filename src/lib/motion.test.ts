import { describe, expect, it } from "vitest";

import { project, rubberband, spring, springSheet, springThrown, springUI } from "./motion";

describe("project — Apple's momentumprojectie", () => {
  it("rekent met exponentieel verval, niet met de natuurkundeformule", () => {
    // (1000 / 1000) * 0.998 / (1 - 0.998) = 499
    expect(project(1000)).toBeCloseTo(499, 5);
  });

  it("staat stil bij snelheid nul", () => {
    expect(project(0)).toBe(0);
  });

  it("houdt de richting van het gebaar aan", () => {
    expect(project(-1000)).toBeCloseTo(-499, 5);
  });

  it("schaalt lineair mee met de snelheid", () => {
    expect(project(2000)).toBeCloseTo(2 * project(1000), 5);
  });

  it("remt sneller af bij een lagere decelerationRate", () => {
    expect(Math.abs(project(1000, 0.99))).toBeLessThan(Math.abs(project(1000, 0.998)));
  });
});

describe("rubberband — zachte grenzen", () => {
  it("beweegt niet zonder overschrijding", () => {
    expect(rubberband(0, 400)).toBe(0);
  });

  it("volgt steeds minder naarmate je verder trekt", () => {
    expect(rubberband(200, 400) / 200).toBeLessThan(rubberband(50, 400) / 50);
  });

  it("blijft altijd binnen de gesleepte afstand", () => {
    for (const overshoot of [10, 50, 100, 300, 1000]) {
      expect(rubberband(overshoot, 400)).toBeLessThan(overshoot);
    }
  });

  it("werkt symmetrisch in beide richtingen", () => {
    expect(rubberband(-100, 400)).toBeCloseTo(-rubberband(100, 400), 10);
  });
});

describe("spring-tokens", () => {
  it("laat de standaard-UI-spring niet doorveren", () => {
    // Apple's regel: kritisch gedempt tenzij het gebaar zelf momentum had.
    expect(springUI).toMatchObject({ type: "spring", bounce: 0 });
  });

  it("geeft alleen de worp-spring een merkbare bounce", () => {
    expect(springThrown.bounce).toBeGreaterThan(springSheet.bounce as number);
    expect(springSheet.bounce).toBeGreaterThan(springUI.bounce as number);
  });

  it("houdt elke respons binnen een halve seconde", () => {
    for (const s of Object.values(spring)) {
      expect(s.visualDuration).toBeLessThanOrEqual(0.5);
    }
  });
});
