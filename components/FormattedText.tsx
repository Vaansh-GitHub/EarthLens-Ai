import React from "react";

interface FormattedTextProps {
  text?: string | null;
  className?: string;
  as?: "span" | "p" | "div";
}

/**
 * Parses markdown bold (**text**) into <strong> tags so double asterisks
 * are rendered as bold typography instead of literal characters.
 */
export function FormattedText({ text, className = "", as = "span" }: FormattedTextProps) {
  if (!text) return null;

  // Split on markdown bold delimiters: **bold text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  const content = parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-bold text-inherit">
          {boldText}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });

  const Component = as;
  return <Component className={className}>{content}</Component>;
}
