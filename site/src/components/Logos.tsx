export function ItaLogo({ size = 80 }: { size?: number }) {
  return (
    <img
      src="https://upload.wikimedia.org/wikipedia/pt/1/1f/ITA_logo.png"
      alt="ITA"
      width={size}
      height={Math.round(size * 0.38)}
      style={{ height: "auto", objectFit: "contain" }}
    />
  );
}

export function MitLogo({ size = 80 }: { size?: number }) {
  return (
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/5/5d/MIT_logo_2003-2023.svg"
      alt="MIT"
      width={size}
      height={Math.round(size * 0.38)}
      style={{ height: "auto", objectFit: "contain" }}
    />
  );
}
