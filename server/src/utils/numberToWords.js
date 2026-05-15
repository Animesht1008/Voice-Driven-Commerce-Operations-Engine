function numberToWordsIndian(input) {
  let num = Number(input);
  if (!isFinite(num)) return String(input);
  num = Math.floor(Math.abs(num));
  if (num === 0) return "zero";

  const units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const twoDigit = (n) => {
    if (n < 20) return units[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return tens[t] + (u ? " " + units[u] : "");
  };

  const threeDigit = (n) => {
    if (n < 100) return twoDigit(n);
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return units[h] + " hundred" + (rem ? " " + twoDigit(rem) : "");
  };

  const parts = [];

  const crore = Math.floor(num / 10000000);
  if (crore) {
    parts.push(threeDigit(crore) + " crore");
    num = num % 10000000;
  }

  const lakh = Math.floor(num / 100000);
  if (lakh) {
    parts.push(twoDigit(lakh) + " lakh");
    num = num % 100000;
  }

  const thousand = Math.floor(num / 1000);
  if (thousand) {
    parts.push(twoDigit(thousand) + " thousand");
    num = num % 1000;
  }

  if (num) {
    parts.push(threeDigit(num));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

module.exports = { numberToWordsIndian };
