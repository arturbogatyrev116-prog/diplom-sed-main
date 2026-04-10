import { describe, expect, it } from "vitest";
import { DocumentType } from "@prisma/client";
import { documentBodySchema, parseDocumentBodyFromFormData } from "@/lib/validation/document";

describe("document validation", () => {
  it("accepts valid document body", () => {
    const r = documentBodySchema.safeParse({
      title: "  Тест  ",
      type: DocumentType.MEMO,
      content: "Hello",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Тест");
    }
  });

  it("rejects empty title/content", () => {
    const r = documentBodySchema.safeParse({
      title: " ",
      type: DocumentType.MEMO,
      content: "",
    });
    expect(r.success).toBe(false);
  });

  it("parses from FormData and rejects unknown type", () => {
    const fd = new FormData();
    fd.set("title", "X");
    fd.set("type", "UNKNOWN");
    fd.set("content", "Y");
    const r = parseDocumentBodyFromFormData(fd);
    expect(r.success).toBe(false);
  });
});

