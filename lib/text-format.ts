export function titleCaseName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((piece) =>
          piece ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece
        )
        .join("-")
    )
    .join(" ");
}

