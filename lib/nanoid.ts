export function nanoid(size = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    for (let i = 0; i < size; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < size; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}
