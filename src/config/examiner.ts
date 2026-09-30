import type { Framing } from "@/avatar/renderer/PhotoRigRenderer";

export const EXAMINER = {
  name: "Muslima",
  title: "IELTS Speaking Examiner",
  /** Reference picture of the examiner in the exam room, and its rig from scripts/build_rig.py. */
  image: "/examiner/room-scene.jpg",
  rig: "/examiner/rig.json",
  /** Centre on her; zoom in more on narrow screens so her face stays readable. */
  framing: { focus: [0.54, 0.5], zoomWide: 1.1, zoomTall: 1.5 } satisfies Framing,
};
