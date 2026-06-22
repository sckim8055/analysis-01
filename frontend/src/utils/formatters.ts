/**
 * Formats a statistical value according to APA style by omitting the leading zero 
 * for values that cannot exceed 1 (e.g. correlation, factor loading, p-value).
 * 
 * Examples:
 * formatStatNumber(0.685) -> ".685"
 * formatStatNumber(-0.685) -> "-.685"
 * formatStatNumber(1.000) -> "1.000" (or "1.00" depending on decimal places, standard is to keep it)
 */
export const formatStatNumber = (value: number, fractionDigits: number = 3): string => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Format with fixed decimals
  let strValue = absValue.toFixed(fractionDigits);
  
  // If the absolute value is strictly less than 1, strip the leading "0"
  if (absValue < 1) {
    if (strValue.startsWith('0.')) {
      strValue = strValue.substring(1);
    }
  }
  
  return isNegative ? `-${strValue}` : strValue;
};
