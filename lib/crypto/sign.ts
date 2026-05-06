/// <reference types="node" />
import forge from "node-forge";
import fs from "fs";
import path from "path";
import { sha256 } from "./hash";

const SIGNATURES_DIR = path.join(process.cwd(), "data", "signatures");

/**
 * Декодирование поля субъекта сертификата.
 * node-forge хранит значение как «сырую» строку (байты → символы 1:1).
 * Если поле кодировалось как UTF8String, нужно вернуть его как UTF-8.
 */
function decodeSubjectField(
  field: ReturnType<forge.pki.Certificate["subject"]["getField"]>,
): string | undefined {
  if (!field) return undefined;
  if (field.valueTagClass === forge.asn1.Type.UTF8) {
    const raw = field.value;
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  return field.value;
}

/**
 * Создание CMS (PKCS#7) подписи для документа.
 *
 * Использует приватный ключ и сертификат пользователя для создания
 * отсоединённой (detached) CMS подписи формата SignedData.
 *
 * @param content — содержимое документа для подписания
 * @param privateKeyPath — путь к PEM файлу приватного ключа
 * @param certificatePath — путь к PEM файлу сертификата
 * @returns путь к файлу .p7s
 */
export function createCMSSignature(params: {
  content: string;
  privateKeyPath: string;
  certificatePath: string;
  documentId: string;
}): string {
  const { content, privateKeyPath, certificatePath, documentId } = params;

  // 1. Читаем ключ и сертификат
  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf8");
  const certificatePem = fs.readFileSync(certificatePath, "utf8");

  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const certificate = forge.pki.certificateFromPem(certificatePem);

  // 2. Создаём CMS SignedData (detached — контент не включается в подпись)
  const p7 = forge.pkcs7.createSignedData();

  // Контент для хеширования
  p7.content = forge.util.createBuffer(content, "utf8");

  // Добавляем сертификат и ключ подписанта
  p7.addCertificate(certificate);
  p7.addSigner({
    key: privateKey,
    certificate: certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date(),
      },
    ],
  });

  // 3. Подписываем (detached = контент отдельно от подписи)
  p7.sign({ detached: true });

  // 4. Сериализуем в DER, затем в Base64 (.p7s файл)
  const p7Asn1 = p7.toAsn1();
  const der = forge.asn1.toDer(p7Asn1).getBytes();
  const p7sBase64 = forge.util.encode64(der);

  // DER сертификата для последующей верификации
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
  const certDerBase64 = forge.util.encode64(certDer);

  // Хеш подписанных атрибутов для верификации
  const signer = p7.signers[0];
  const authAttrsDigestHex = signer.md.digest().toHex();

  // SHA-256 контента для проверки при верификации
  const contentHash = forge.md.sha256.create().update(content).digest().toHex();

  // 5. Сохраняем файл подписи (формат: certDer\nauthAttrsDigest\ncontentHash\np7s)
  fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
  const signaturePath = path.join(SIGNATURES_DIR, `${documentId}.p7s`);
  fs.writeFileSync(signaturePath, `${certDerBase64}\n${authAttrsDigestHex}\n${contentHash}\n${p7sBase64}`, "utf8");

  return signaturePath;
}

/**
 * Верификация CMS подписи документа.
 */
export function verifyCMSSignature(params: {
  content: string;
  signaturePath: string;
}): {
  valid: boolean;
  signerCommonName?: string;
  signerEmail?: string;
  signingTime?: Date;
  error?: string;
} {
  const { content, signaturePath } = params;

  try {
    const fileContent = fs.readFileSync(signaturePath, "utf8");
    const lines = fileContent.trim().split("\n");

    let certDerBase64: string;
    let authAttrsDigestHex: string;
    let contentHash: string;
    let p7sBase64: string;

    if (lines.length >= 4) {
      certDerBase64 = lines[0];
      authAttrsDigestHex = lines[1];
      contentHash = lines[2];
      p7sBase64 = lines[3];
    } else if (lines.length >= 3) {
      certDerBase64 = lines[0];
      authAttrsDigestHex = lines[1];
      contentHash = "";
      p7sBase64 = lines[2];
    } else if (lines.length >= 2) {
      certDerBase64 = lines[0];
      p7sBase64 = lines[1];
      authAttrsDigestHex = "";
      contentHash = "";
    } else {
      p7sBase64 = lines[0];
      certDerBase64 = "";
      authAttrsDigestHex = "";
      contentHash = "";
    }

    const derBytes = forge.util.decode64(p7sBase64);
    const asn1Root = forge.asn1.fromDer(derBytes);

    const signedData = asn1Root.value?.[1]?.value?.[0];
    if (!signedData) return { valid: false, error: "Неверный формат PKCS#7" };
    
    const certsWrapper = signedData.value?.[3];
    const certificatesAsn1 = certsWrapper?.value;
    const signerInfosSeq = signedData.value?.[4];

    if (!signerInfosSeq?.value?.length) {
      return { valid: false, error: "Информация о подписанте не найдена" };
    }

    const signerInfo = signerInfosSeq.value[0];

    // 3. Сертификат
    let cert: forge.pki.Certificate | undefined;
    if (certDerBase64) {
      try {
        const certDerBytes = forge.util.decode64(certDerBase64);
        cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(certDerBytes));
      } catch { /* ignore */ }
    }
    if (!cert && certificatesAsn1?.length) {
      try {
        const certDer = forge.asn1.toDer(certificatesAsn1[0]).getBytes();
        cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(certDer));
      } catch { /* ignore */ }
    }
    if (!cert) {
      return { valid: false, error: "Сертификат подписанта не найден" };
    }

    const signerCN = decodeSubjectField(cert.subject.getField("CN"));
    const emailAttr = (cert.subject.attributes as any[]).find(
      (a: any) => a.type === forge.pki.oids.emailAddress
    );
    const signerEmail = emailAttr?.value;

    // 4. Подписанные атрибуты (для извлечения signingTime)
    const authAttrsAsn1 = signerInfo.value?.[3];
    let signingTime: Date | undefined;
    const stOidHex = forge.util.bytesToHex(forge.asn1.oidToDer(forge.pki.oids.signingTime).getBytes());

    if (authAttrsAsn1?.value) {
      for (const attr of authAttrsAsn1.value) {
        try {
          const oidNode = attr.value[0];
          const oidRaw = oidNode.value;
          const oidHex = typeof oidRaw === "string"
            ? forge.util.bytesToHex(oidRaw)
            : forge.util.bytesToHex((oidRaw as forge.util.ByteBuffer).getBytes());
          const attrValue = attr.value[1].value[0];
          if (oidHex === stOidHex) {
            const v = attrValue.value;
            let timeStr: string | null = null;
            if (v instanceof Date && !Number.isNaN(v.getTime())) {
              signingTime = v;
            } else if (typeof v === "string") {
              timeStr = v;
            } else if (v && typeof (v as forge.util.ByteBuffer).getBytes === "function") {
              timeStr = (v as forge.util.ByteBuffer).getBytes();
            }
            if (timeStr) {
              // ASN.1 UTCTime: "YYMMDDHHmmssZ" (12 цифр + Z) или GeneralizedTime: "YYYYMMDDHHmmssZ" (14 цифр + Z)
              const digits = timeStr.replace(/\D/g, "");
              let parsed: Date | undefined;
              if (digits.length === 12) {
                // UTCTime: YYMMDDHHmmss
                const y = +digits.slice(0, 2);
                const year = y >= 50 ? 1900 + y : 2000 + y;
                parsed = new Date(Date.UTC(year, +digits.slice(2, 4) - 1, +digits.slice(4, 6), +digits.slice(6, 8), +digits.slice(8, 10), +digits.slice(10, 12)));
              } else if (digits.length === 14) {
                // GeneralizedTime: YYYYMMDDHHmmss
                parsed = new Date(Date.UTC(+digits.slice(0, 4), +digits.slice(4, 6) - 1, +digits.slice(6, 8), +digits.slice(8, 10), +digits.slice(10, 12), +digits.slice(12, 14)));
              }
              if (parsed && !Number.isNaN(parsed.getTime())) {
                signingTime = parsed;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // 5. Проверка содержимого (contentHash из файла)
    if (contentHash) {
      const computedContentDigest = forge.md.sha256.create().update(content).digest().toHex();
      if (contentHash !== computedContentDigest) {
        return {
          valid: false, signerCommonName: signerCN, signerEmail: signerEmail, signingTime,
          error: "Содержимое документа изменено после подписания",
        };
      }
    }

    // 6. RSA верификация подписи
    if (!authAttrsDigestHex) {
      return { valid: false, error: "Хеш подписанных атрибутов отсутствует" };
    }

    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    const signatureBytes = signerInfo.value[5].value;

    try {
      const verified = publicKey.verify(
        forge.util.hexToBytes(authAttrsDigestHex),
        signatureBytes,
        forge.pki.rsa.PADDING_PKCS1,
      );

      if (!verified) {
        return {
          valid: false, signerCommonName: signerCN, signerEmail: signerEmail, signingTime,
          error: "Криптографическая верификация не пройдена",
        };
      }
    } catch {
      return {
        valid: false, signerCommonName: signerCN, signerEmail: signerEmail, signingTime,
        error: "Ошибка криптографической верификации",
      };
    }

    return { valid: true, signerCommonName: signerCN, signerEmail: signerEmail, signingTime };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Неизвестная ошибка" };
  }
}

/** Проверить, существует ли файл подписи для документа */
export function hasDocumentSignature(documentId: string): boolean {
  const signaturePath = path.join(SIGNATURES_DIR, `${documentId}.p7s`);
  return fs.existsSync(signaturePath);
}

/** Получить путь к файлу подписи документа */
export function getDocumentSignaturePath(documentId: string): string | null {
  const signaturePath = path.join(SIGNATURES_DIR, `${documentId}.p7s`);
  if (!fs.existsSync(signaturePath)) return null;
  return signaturePath;
}
