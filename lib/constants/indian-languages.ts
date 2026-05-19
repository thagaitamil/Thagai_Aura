/** Major Indian languages for supply / lead UI (labels + stored value). */
export const INDIAN_LANGUAGES: { value: string; label: string }[] = [
  { value: "Tamil", label: "Tamil" },
  { value: "Telugu", label: "Telugu" },
  { value: "Kannada", label: "Kannada" },
  { value: "Malayalam", label: "Malayalam" },
  { value: "Hindi", label: "Hindi" },
  { value: "English", label: "English" },
  { value: "Marathi", label: "Marathi" },
  { value: "Gujarati", label: "Gujarati" },
  { value: "Bengali", label: "Bengali" },
  { value: "Odia", label: "Odia" },
  { value: "Punjabi", label: "Punjabi" },
  { value: "Urdu", label: "Urdu" },
  { value: "Assamese", label: "Assamese" },
  { value: "Konkani", label: "Konkani" },
  { value: "Manipuri", label: "Manipuri (Meitei)" },
  { value: "Bodo", label: "Bodo" },
  { value: "Dogri", label: "Dogri" },
  { value: "Kashmiri", label: "Kashmiri" },
  { value: "Maithili", label: "Maithili" },
  { value: "Nepali", label: "Nepali" },
  { value: "Sanskrit", label: "Sanskrit" },
  { value: "Santali", label: "Santali" },
  { value: "Sindhi", label: "Sindhi" },
];

export function languagesToStored(selected: string[]): string {
  return selected.filter(Boolean).join(", ");
}

export function storedToLanguages(s: string | null | undefined): string[] {
  if (!s?.trim()) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
