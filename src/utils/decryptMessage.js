import crypto from "crypto";

const decryptMessage = (data, sessionKeyBase64) => {
  const key = Buffer.from(sessionKeyBase64, "base64");

  const [ivBase64, encryptedBase64, receivedHmac] = data.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  // Recalculate HMAC
  const recalculatedHmac = crypto.createHmac("sha256", key)
    .update(Buffer.concat([iv, encrypted]))
    .digest("hex");

  if (recalculatedHmac !== receivedHmac) {
    throw new Error("HMAC verification failed — message may have been tampered with.");
  }

  // Decrypt
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

export { decryptMessage };
