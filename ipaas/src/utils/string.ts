export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const toCamelCase = (s: string) => {
  const words = s.split(/[\s_-]+/);
  if (words.length === 0) return '';
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())).join('');
};
