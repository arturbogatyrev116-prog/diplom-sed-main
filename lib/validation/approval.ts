import { z } from "zod";

export const submitForApprovalSchema = z.object({
  documentId: z.string().min(1),
  approverId: z.string().min(1),
});

export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>;

export function parseSubmitForApprovalFromFormData(formData: FormData) {
  return submitForApprovalSchema.safeParse({
    documentId: typeof formData.get("documentId") === "string" ? (formData.get("documentId") as string) : "",
    approverId: typeof formData.get("approverId") === "string" ? (formData.get("approverId") as string) : "",
  });
}

export const approvalDecisionSchema = z
  .object({
    stepId: z.string().min(1),
    decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
    comment: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.decision === "RETURN") {
      const c = (val.comment ?? "").trim();
      if (c.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "comment_required",
          path: ["comment"],
        });
      } else if (c.length > 4000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "comment_too_long",
          path: ["comment"],
        });
      }
    }
  });

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export function parseApprovalDecisionFromFormData(formData: FormData) {
  return approvalDecisionSchema.safeParse({
    stepId: typeof formData.get("stepId") === "string" ? (formData.get("stepId") as string) : "",
    decision: typeof formData.get("decision") === "string" ? (formData.get("decision") as string) : "",
    comment: typeof formData.get("comment") === "string" ? (formData.get("comment") as string) : "",
  });
}

export const archiveDocumentSchema = z.object({
  documentId: z.string().min(1),
});

export type ArchiveDocumentInput = z.infer<typeof archiveDocumentSchema>;

export function parseArchiveDocumentFromFormData(formData: FormData) {
  return archiveDocumentSchema.safeParse({
    documentId: typeof formData.get("documentId") === "string" ? (formData.get("documentId") as string) : "",
  });
}

