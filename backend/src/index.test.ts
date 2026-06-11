import { describe, expect, it } from "vitest";

import { SERVICE_NAME } from "./index";

describe("backend scaffold", () => {
  it("exports the service name placeholder", () => {
    expect(SERVICE_NAME).toBe("pdlc-test-backend");
  });
});
