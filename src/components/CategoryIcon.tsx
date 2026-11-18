import React from "react";
import { getDynamicIcon, hasDynamicIcon } from "./dynamicIcons";

interface CategoryIconProps {
  icon: string;
  className?: string;
  size?: number;
}

function isUrl(value: string): boolean {
  return /^(https?:|data:|\/)/.test(value);
}

// Nama ikon gaya Material Symbols dari picker kategori FE-POS (mis. "restaurant").
function isIconName(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value) || hasDynamicIcon(value);
}

const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  className = "text-lg",
  size = 20,
}) => {
  if (!icon) return null;

  if (isUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`inline-block rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (isIconName(icon)) {
    // Sama dengan FE-POS (DynamicIcon): lucide, bukan font Material Symbols.
    return React.createElement(getDynamicIcon(icon), {
      size,
      "aria-hidden": true,
      className: `inline-block shrink-0 ${className}`,
    });
  }

  return <span className={className}>{icon}</span>;
};

export default CategoryIcon;