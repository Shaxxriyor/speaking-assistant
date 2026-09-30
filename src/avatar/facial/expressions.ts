import type { ExpressionName } from "@/types/avatar";

/** Facial targets per expression, relative to the reference photo (which already has a gentle smile). */
export interface ExpressionShape {
  browRaise: number;
  browFurrow: number;
  smile: number;
  /** Extra lid closure (cheek raise when smiling, lowered lids when reading). */
  squint: number;
}

export const EXPRESSIONS: Record<ExpressionName, ExpressionShape> = {
  neutral: { browRaise: 0, browFurrow: 0, smile: 0, squint: 0 },
  warm: { browRaise: 0.15, browFurrow: 0, smile: 0.45, squint: 0.08 },
  attentive: { browRaise: 0.12, browFurrow: 0, smile: 0.08, squint: 0 },
  thinking: { browRaise: -0.05, browFurrow: 0.45, smile: -0.15, squint: 0.05 },
  speaking: { browRaise: 0.05, browFurrow: 0, smile: 0.08, squint: 0 },
  reading: { browRaise: -0.05, browFurrow: 0.12, smile: -0.08, squint: 0.05 },
  concerned: { browRaise: 0.1, browFurrow: 0.3, smile: -0.25, squint: 0 },
};
