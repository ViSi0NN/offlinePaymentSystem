

import crypto from "crypto";

const IV_LENGTH = 16;

const encryptMessage = (plaintext, sessionKeyBase64) => {
  const key = Buffer.from(sessionKeyBase64, "base64");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Generate HMAC (iv + ciphertext)
  const hmac = crypto.createHmac("sha256", key)
    .update(Buffer.concat([iv, encrypted]))
    .digest("hex");

  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${hmac}`;
};

export { encryptMessage };



