/** Save bytes through the browser without navigating to or opening the file. */
export const saveFile = function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    return URL.revokeObjectURL(url);
  }, 60000);
};
