import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Display label for a car: vehicle_number (brand model) so users can identify by model, not just number. */
export function formatCarLabel(car: {
  vehicle_number: string;
  model?: string | null;
  brand?: string | null;
}): string {
  const extra = [car.brand, car.model].filter(Boolean).join(' ');
  return extra ? `${car.vehicle_number} (${extra})` : car.vehicle_number;
}
