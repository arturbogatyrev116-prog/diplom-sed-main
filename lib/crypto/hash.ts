import { createHash } from "crypto";

/**
 * Вычисление SHA-256 хеша содержимого.
 * Используется для фиксации контента документа на момент подписания.
 */
export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
