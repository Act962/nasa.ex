export const handleOpen = (url: string) => {
  window.open(url, "_blank");
};

export const handleDownload = async (url: string, fileName?: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.download = fileName || "document";
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
