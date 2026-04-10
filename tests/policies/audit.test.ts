import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { canSeeAuditLog } from "@/server/policies/audit";

describe("audit policy", () => {
  it("allows /audit only for ADMIN", () => {
    expect(canSeeAuditLog({ userId: "u1", role: UserRole.ADMIN })).toBe(true);

    expect(canSeeAuditLog({ userId: "u1", role: UserRole.EMPLOYEE })).toBe(false);
    expect(canSeeAuditLog({ userId: "u1", role: UserRole.MANAGER })).toBe(false);
    expect(canSeeAuditLog({ userId: "u1", role: UserRole.OWNER })).toBe(false);
  });
});

