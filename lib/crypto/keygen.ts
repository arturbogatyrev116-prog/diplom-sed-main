/// <reference types="node" />
import forge from "node-forge";
import fs from "fs";
import path from "path";

const KEYS_DIR = path.join(process.cwd(), "data", "keys");
const CERTS_DIR = path.join(process.cwd(), "data", "certs");

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

/** Убедиться, что директории существуют */
function ensureDirs(userId: string) {
  const userKeysDir = path.join(KEYS_DIR, userId);
  const userCertsDir = path.join(CERTS_DIR, userId);
  fs.mkdirSync(userKeysDir, { recursive: true });
  fs.mkdirSync(userCertsDir, { recursive: true });
  return { userKeysDir, userCertsDir };
}

/**
 * Генерация RSA-2048 ключевой пары + самоподписанный X.509 сертификат.
 * Аналог Python-скрипта из амир.txt, но на TypeScript + node-forge.
 */
export function generateKeyPairAndCertificate(params: {
  userId: string;
  email: string;
  fullName: string;
}): {
  privateKeyPem: string;
  certificatePem: string;
  privateKeyPath: string;
  certificatePath: string;
} {
  const { userId, email, fullName } = params;

  // 1. Генерация RSA-2048 ключевой пары
  const keypair = forge.pki.rsa.generateKeyPair(2048);

  // 2. Создание самоподписанного X.509 сертификата
  const cert = forge.pki.createCertificate();
  cert.publicKey = keypair.publicKey;
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));

  const validYears = 1;
  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(now);
  cert.validity.notAfter.setFullYear(now.getFullYear() + validYears);

  // Атрибуты сертификата (как в Python-скрипте)
  const attrs = [
    { name: "countryName", value: "RU" },
    { name: "stateOrProvinceName", value: "Russian Federation" },
    { name: "localityName", value: "Moscow" },
    { name: "organizationName", value: "Diplom SED" },
    { name: "commonName", value: fullName, valueTagClass: forge.asn1.Type.UTF8 },
    { name: "emailAddress", value: email, type: forge.pki.oids.emailAddress, valueTagClass: forge.asn1.Type.IA5 },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs); // Самоподписанный = issuer = subject

  // 3. Подпись сертификата приватным ключом (SHA-256)
  cert.sign(keypair.privateKey, forge.md.sha256.create());

  // 4. Сериализация в PEM
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const certificatePem = forge.pki.certificateToPem(cert);

  // 5. Сохранение в файловую систему
  const { userKeysDir, userCertsDir } = ensureDirs(userId);
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const privateKeyPath = path.join(userKeysDir, `private_key_${timestamp}.pem`);
  const certificatePath = path.join(userCertsDir, `certificate_${timestamp}.pem`);

  fs.writeFileSync(privateKeyPath, privateKeyPem, "utf8");
  fs.writeFileSync(certificatePath, certificatePem, "utf8");

  return {
    privateKeyPem,
    certificatePem,
    privateKeyPath,
    certificatePath,
  };
}

/** Получить путь к приватному ключу пользователя (последний файл) */
export function getUserPrivateKeyPath(userId: string): string {
  const userKeysDir = path.join(KEYS_DIR, userId);
  if (!fs.existsSync(userKeysDir)) {
    throw new Error("Ключи пользователя не найдены");
  }
  const files = fs
    .readdirSync(userKeysDir)
    .filter((f) => f.endsWith(".pem"))
    .sort()
    .reverse();
  if (files.length === 0) {
    throw new Error("Приватный ключ пользователя не найден");
  }
  return path.join(userKeysDir, files[0]);
}

/** Получить путь к сертификату пользователя (последний файл) */
export function getUserCertificatePath(userId: string): string {
  const userCertsDir = path.join(CERTS_DIR, userId);
  if (!fs.existsSync(userCertsDir)) {
    throw new Error("Сертификаты пользователя не найдены");
  }
  const files = fs
    .readdirSync(userCertsDir)
    .filter((f) => f.endsWith(".pem"))
    .sort()
    .reverse();
  if (files.length === 0) {
    throw new Error("Сертификат пользователя не найден");
  }
  return path.join(userCertsDir, files[0]);
}

/** Проверить, есть ли у пользователя сертификат */
export function hasUserCertificate(userId: string): boolean {
  const userCertsDir = path.join(CERTS_DIR, userId);
  if (!fs.existsSync(userCertsDir)) return false;
  return fs
    .readdirSync(userCertsDir)
    .some((f) => f.endsWith(".pem"));
}

/** Получить информацию о сертификате пользователя */
export function getCertificateInfo(userId: string): {
  commonName: string;
  email: string;
  notBefore: Date;
  notAfter: Date;
  serialNumber: string;
} | null {
  try {
    const certPath = getUserCertificatePath(userId);
    const pem = fs.readFileSync(certPath, "utf8");
    const cert = forge.pki.certificateFromPem(pem);

    const cn = decodeSubjectField(cert.subject.getField("CN")) ?? "";
    // emailAddress имеет shortName 'E', ищем по OID (type)
    const emailAttr = (cert.subject.attributes as any[]).find(
      (a: any) => a.type === forge.pki.oids.emailAddress
    );
    const email = emailAttr?.value ?? "";

    return {
      commonName: cn,
      email,
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
      serialNumber: cert.serialNumber,
    };
  } catch {
    return null;
  }
}
