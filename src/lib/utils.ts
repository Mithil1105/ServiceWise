import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Display label for a car: car name first, then registration in brackets e.g. "Kia Carens (GJ-18-BQ-0142)". */
export function formatCarLabel(car: {
  vehicle_number: string;
  model?: string | null;
  brand?: string | null;
}): string {
  const brand = (car.brand || '').trim();
  const model = (car.model || '').trim();
  let name: string;
  if (brand && model) {
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      name = brand + ' ' + model.slice(brand.length).trim();
    } else {
      name = brand + ' ' + model;
    }
  } else {
    name = brand || model || '';
  }
  name = name.trim();
  return name ? `${name} (${car.vehicle_number})` : car.vehicle_number;
}
