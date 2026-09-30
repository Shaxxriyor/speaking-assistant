/** Output of scripts/build_rig.py: landmark positions (pixels) in the examiner reference picture. */
export interface AvatarRig {
  image: { width: number; height: number };
  points: Record<RigPoint, [number, number]>;
  /** Body region that breathes/leans (ellipse, pixels). */
  torso: { center: [number, number]; radius: [number, number] };
  /** Top edge of the desk; her forearms rest on it, so nothing below it moves with the body. */
  deskY: number;
}

export type RigPoint =
  | "mouthLeft"
  | "mouthRight"
  | "upperLipTop"
  | "upperLipInner"
  | "lowerLipInner"
  | "lowerLipBottom"
  | "chin"
  | "jawLeft"
  | "jawRight"
  | "noseTip"
  | "forehead"
  | "eyeLOuter"
  | "eyeLInner"
  | "eyeLTop"
  | "eyeLBottom"
  | "irisL"
  | "eyeROuter"
  | "eyeRInner"
  | "eyeRTop"
  | "eyeRBottom"
  | "irisR"
  | "browLOuter"
  | "browLMid"
  | "browLInner"
  | "browROuter"
  | "browRMid"
  | "browRInner"
  | "wrist"
  | "indexTip"
  | "thumbTip"
  | "penTip"
  | "penTop";
