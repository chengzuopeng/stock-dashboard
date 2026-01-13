/**
 * Logo 组件 - 股票看板 Logo
 * 设计理念：K线图抽象化，展现上涨趋势
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  const logoUrl = new URL('logo.svg', import.meta.env.BASE_URL).toString();
  return (
    <img
      src={logoUrl}
      alt="Logo"
      width={size}
      height={size}
      className={className}
    />
  );
}
