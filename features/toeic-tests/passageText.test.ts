import { describe, expect, it } from "vitest";
import { normalizeToeicPassageText } from "./passageText";

describe("normalizeToeicPassageText", () => {
  it("turns legacy HTML passage content into readable safe text", () => {
    expect(
      normalizeToeicPassageText(
        "<div><p>Riverside &amp; Co.</p><p>Thank you.</p></div>",
      ),
    ).toBe("Riverside & Co.\nThank you.");
  });

  it("keeps existing plain-text passages unchanged", () => {
    expect(
      normalizeToeicPassageText(
        "Questions 147-148 refer to the following notice.",
      ),
    ).toBe("Questions 147-148 refer to the following notice.");
  });

  it("collapses repeated blank lines in plain-text passages", () => {
    expect(
      normalizeToeicPassageText("To: Managers\n\n\nFrom: Charlotte Black"),
    ).toBe("To: Managers\nFrom: Charlotte Black");
  });
});
