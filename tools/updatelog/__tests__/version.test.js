"use strict";

const { parseVersion, isStrictSemver } = require("../lib/version");

describe("version", () => {
  it("parses strict semver", () => {
    const result = parseVersion("1.2.3");
    expect(result.ok).toBe(true);
    expect(result.value.major).toBe(1);
    expect(result.value.minor).toBe(2);
    expect(result.value.patch).toBe(3);
  });

  it("rejects non-strict semver", () => {
    expect(isStrictSemver("1.2")).toBe(false);
    expect(isStrictSemver("v1.2.3")).toBe(false);
    expect(parseVersion("1.2.3-beta.1").ok).toBe(false);
  });
});
