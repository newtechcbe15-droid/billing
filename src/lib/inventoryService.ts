import { localDB, generateId } from "./localDB";

export interface InventoryDeductionResult {
  deducted: boolean;
  partName?: string;
  matchedItem?: any;
  previousQuantity?: number;
  newQuantity?: number;
  message?: string;
}

/**
 * Detect what hardware part was replaced from customer complaint text
 */
export function detectReplacedPart(complaint: string): string | null {
  if (!complaint) return null;
  const c = complaint.toLowerCase();
  
  if (
    c.includes("display") || 
    c.includes("screen") || 
    c.includes("folder") || 
    c.includes("combo") || 
    c.includes("touch") ||
    c.includes("lcd") ||
    c.includes("oled")
  ) {
    return "Display";
  }
  
  if (c.includes("battery")) {
    return "Battery";
  }
  
  if (
    c.includes("cc") || 
    c.includes("charging board") || 
    c.includes("charging port") || 
    c.includes("sub board")
  ) {
    return "CC";
  }
  
  if (c.includes("camera")) {
    return "Camera";
  }
  
  if (c.includes("speaker") || c.includes("ringer") || c.includes("earpiece")) {
    return "Speaker";
  }
  
  if (c.includes("ic")) {
    return "IC";
  }
  
  return null;
}

/**
 * Deduct 1 unit from inventory for a delivered service job
 */
export async function deductInventoryForJob(job: {
  id?: string;
  brand?: string;
  model?: string;
  complaint?: string;
  spare_part_supplier?: string;
  device_type?: string;
}): Promise<InventoryDeductionResult> {
  const partName = detectReplacedPart(job.complaint || "");
  if (!partName) {
    return { deducted: false };
  }

  const stocks = await localDB.stock.getAll();
  const brandLower = (job.brand || "").toLowerCase().trim();
  const modelLower = (job.model || "").toLowerCase().trim();
  const fullModel = `${brandLower} ${modelLower}`.trim();
  const supplier = (job.spare_part_supplier || "").trim();

  let bestMatch: any = null;
  let bestScore = -1;

  for (const s of stocks) {
    if (!s.item || s.item.toLowerCase() !== partName.toLowerCase()) continue;
    const stockModel = (s.supported_model || "").toLowerCase().trim();
    let score = 0;

    if (stockModel && fullModel && stockModel === fullModel) {
      score = 100;
    } else if (stockModel && modelLower && stockModel === modelLower) {
      score = 90;
    } else if (stockModel && fullModel && (stockModel.includes(fullModel) || fullModel.includes(stockModel))) {
      score = 80;
    } else if (stockModel && modelLower && (stockModel.includes(modelLower) || modelLower.includes(stockModel))) {
      score = 70;
    } else if (modelLower && stockModel) {
      // Token-level overlap (e.g., "a51" in "samsung a51")
      const tokens = modelLower.split(/[\s-]+/).filter((t) => t.length > 1);
      if (tokens.some((t) => stockModel.includes(t))) {
        score = 60;
      }
    } else if (!stockModel) {
      score = 10;
    }

    if (score > 0) {
      // Prioritize supplier match if provided
      if (supplier && s.buyed_from && s.buyed_from.toLowerCase() === supplier.toLowerCase()) {
        score += 15;
      }
      // Prioritize available stock in hand
      if (Number(s.quantity) > 0) {
        score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = s;
      }
    }
  }

  const now = new Date().toISOString();

  if (bestMatch) {
    const previousQuantity = Number(bestMatch.quantity) || 0;
    const newQuantity = previousQuantity - 1;
    const updatedStock = {
      ...bestMatch,
      quantity: newQuantity,
      updated_at: now
    };

    try {
      await localDB.stock.save([updatedStock]);
    } catch (err) {
      console.error("Failed to update stock via save, trying direct update:", err);
      await localDB.stock.update(bestMatch.id, { quantity: newQuantity });
    }

    return {
      deducted: true,
      partName,
      matchedItem: updatedStock,
      previousQuantity,
      newQuantity,
      message: `1 ${partName} deducted for ${bestMatch.supported_model || fullModel} (${bestMatch.buyed_from || "Inventory"}). Remaining: ${newQuantity}`
    };
  } else {
    // If no stock item exists for this model yet, create a tracked entry (-1) so inventory registers the consumption
    const newStock = {
      id: generateId(),
      item: partName,
      buyed_from: supplier || "Local",
      quantity: -1,
      supported_model: fullModel || modelLower || "General",
      box_no: "",
      created_at: now,
      updated_at: now
    };

    try {
      await localDB.stock.save([newStock]);
    } catch (err) {
      console.error("Failed to insert stock entry:", err);
    }

    return {
      deducted: true,
      partName,
      matchedItem: newStock,
      previousQuantity: 0,
      newQuantity: -1,
      message: `1 ${partName} recorded as used for ${newStock.supported_model} (Stock alert: -1).`
    };
  }
}
