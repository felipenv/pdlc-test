import { describe, expect, it } from "vitest";

import { mount } from "./main";

describe("frontend scaffold", () => {
  it("mounts a placeholder label into the provided root", () => {
    const root = document.createElement("div");
    mount(root);
    expect(root.textContent).toBe("Scientific Calculator");
  });
});
