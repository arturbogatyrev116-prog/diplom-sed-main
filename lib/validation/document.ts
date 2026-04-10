import { z } from "zod";
import { DocumentType } from "@prisma/client";

const DOCUMENT_TYPE_VALUES = [
  DocumentType.CONTRACT,
  DocumentType.ORDER,
  DocumentType.STATEMENT,
  DocumentType.INVOICE,
  DocumentType.MEMO,
] as const;

const documentTypeSchema = z.enum(DOCUMENT_TYPE_VALUES);

export const documentBodySchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(500),
  type: documentTypeSchema,
  content: z.string().min(1, "Укажите содержимое").max(100_000),
});

export type DocumentBodyInput = z.infer<typeof documentBodySchema>;

export function parseDocumentBodyFromFormData(formData: FormData) {
  const raw = {
    title: formData.get("title"),
    type: formData.get("type"),
    content: formData.get("content"),
  };
  return documentBodySchema.safeParse({
    title: typeof raw.title === "string" ? raw.title : "",
    type: typeof raw.type === "string" ? raw.type : "",
    content: typeof raw.content === "string" ? raw.content : "",
  });
}
