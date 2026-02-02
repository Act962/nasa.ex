export function inputValueToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export function stripBase64Prefix(base64: string): string {
  return base64.split(",")[1] || base64;
}
