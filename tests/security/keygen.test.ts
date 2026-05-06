/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { generateKeyPairAndCertificate, hasUserCertificate, getCertificateInfo } from "@/lib/crypto/keygen";

const TEST_USER_ID = "test-user-crypto-001";

describe("keygen", () => {
  const testKeysDir = path.join(process.cwd(), "data", "keys", TEST_USER_ID);
  const testCertsDir = path.join(process.cwd(), "data", "certs", TEST_USER_ID);

  // Очистка после тестов
  afterEach(() => {
    if (fs.existsSync(path.join(process.cwd(), "data", "keys", TEST_USER_ID))) {
      fs.rmSync(path.join(process.cwd(), "data", "keys", TEST_USER_ID), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(process.cwd(), "data", "certs", TEST_USER_ID))) {
      fs.rmSync(path.join(process.cwd(), "data", "certs", TEST_USER_ID), { recursive: true, force: true });
    }
  });

  it("генерирует ключевую пару и сертификат", () => {
    const result = generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "test@example.com",
      fullName: "Test User",
    });

    expect(result.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
    expect(result.certificatePem).toContain("BEGIN CERTIFICATE");
    expect(fs.existsSync(result.privateKeyPath)).toBe(true);
    expect(fs.existsSync(result.certificatePath)).toBe(true);
  });

  it("hasUserCertificate возвращает true после генерации", () => {
    generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "test@example.com",
      fullName: "Test User",
    });

    expect(hasUserCertificate(TEST_USER_ID)).toBe(true);
  });

  it("hasUserCertificate возвращает false если сертификата нет", () => {
    expect(hasUserCertificate("non-existent-user")).toBe(false);
  });

  it("getCertificateInfo возвращает корректную информацию", () => {
    generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "test@example.com",
      fullName: "Test User",
    });

    const info = getCertificateInfo(TEST_USER_ID);

    expect(info).not.toBeNull();
    expect(info!.commonName).toBe("Test User");
    expect(info!.email).toBe("test@example.com");
    expect(info!.notBefore).toBeInstanceOf(Date);
    expect(info!.notAfter).toBeInstanceOf(Date);
    // Сертификат на 1 год
    expect(info!.notAfter.getFullYear()).toBe(info!.notBefore.getFullYear() + 1);
  });

  it("getCertificateInfo возвращает null если сертификата нет", () => {
    expect(getCertificateInfo("non-existent-user")).toBeNull();
  });
});
