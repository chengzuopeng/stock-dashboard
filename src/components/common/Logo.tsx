/**
 * Logo 组件 - 股票看板 Logo
 * 设计理念：K线图抽象化，展现上涨趋势
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="Logo"
      width={size}
      height={size}
      className={className}
    />
  );
}
