import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount)
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [keys.join(",")].concat(
      data.map((row) => keys.map((k) => row[k]).join(","))
    ).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
