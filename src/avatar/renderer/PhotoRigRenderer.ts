import type { AvatarPose } from "@/types/avatar";
import type { AvatarRig } from "@/types/rig";
import { clamp } from "@/utils/math";
import type { AvatarRenderer } from "./AvatarRenderer";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./photoRigShader";
import { rigGeometry, type RigGeometry } from "./rigGeometry";

export interface Framing {
  /** Point of the picture to keep centred, normalised 0 … 1. */
  focus: [number, number];
  /** Zoom beyond "cover" for landscape and portrait viewports. */
  zoomWide: number;
  zoomTall: number;
}

/** How far normalised pose values move pixels, as fractions of the face width. Keep small: realism lives here. */
const SCALE = {
  headYaw: 0.07,
  headPitch: 0.06,
  torsoShift: 0.05,
  handX: 7,
  handY: 5,
  penRotation: 0.05,
  browRaise: 0.22,
  browFurrow: 0.18,
  smile: 0.12,
};

/**
 * First-prototype renderer: animates the single reference picture of the examiner in WebGL using the rig
 * (landmarks) from scripts/build_rig.py. Every part of her moves independently; the room stays still.
 */
export class PhotoRigRenderer implements AvatarRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly geo: RigGeometry;
  private size = { w: 1, h: 1 };

  constructor(
    private readonly imageUrl: string,
    private readonly rig: AvatarRig,
    private readonly framing: Framing,
  ) {
    this.geo = rigGeometry(rig);
  }

  async mount(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL is not available");
    this.gl = gl;
    this.program = this.compile(gl);
    gl.useProgram(this.program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    await this.loadTexture(gl);
    this.setStaticUniforms();
  }

  private compile(gl: WebGLRenderingContext) {
    const shader = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
      return sh;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link error");
    return program;
  }

  private loadTexture(gl: WebGLRenderingContext) {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        resolve();
      };
      img.onerror = () => reject(new Error(`Could not load ${this.imageUrl}`));
      img.src = this.imageUrl;
    });
  }

  private u(name: string) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl!.getUniformLocation(this.program!, name));
    return this.uniforms.get(name)!;
  }

  private setStaticUniforms() {
    const gl = this.gl!;
    const g = this.geo;
    gl.uniform2f(this.u("u_img"), this.rig.image.width, this.rig.image.height);
    gl.uniform2f(this.u("u_torsoC"), ...g.torso.center);
    gl.uniform2f(this.u("u_torsoR"), ...g.torso.radius);
    gl.uniform1f(this.u("u_deskY"), g.deskY);
    gl.uniform2f(this.u("u_headC"), ...g.head.c);
    gl.uniform1f(this.u("u_headR"), g.head.r);
    gl.uniform2f(this.u("u_pivot"), ...g.head.pivot);
    gl.uniform2f(this.u("u_handC"), ...g.hand.c);
    gl.uniform1f(this.u("u_handR"), g.hand.r);
    gl.uniform2f(this.u("u_wrist"), ...g.hand.wrist);
    gl.uniform2fv(this.u("u_ec"), g.eyes.flatMap((e) => e.c));
    gl.uniform2fv(this.u("u_ex"), g.eyes.flatMap((e) => e.ex));
    gl.uniform4fv(this.u("u_edim"), g.eyes.flatMap((e) => e.dim));
    gl.uniform2fv(this.u("u_iris"), g.eyes.flatMap((e) => e.iris));
    gl.uniform1fv(this.u("u_irisR"), g.eyes.map((e) => e.irisR));
    gl.uniform2fv(this.u("u_bc"), g.brows.flatMap((b) => b.c));
    gl.uniform2fv(this.u("u_bx"), g.brows.flatMap((b) => b.bx));
    gl.uniform3fv(this.u("u_bdim"), g.brows.flatMap((b) => b.dim));
    gl.uniform2f(this.u("u_mc"), ...g.mouth.mc);
    gl.uniform2f(this.u("u_mx"), ...g.mouth.mx);
    gl.uniform2f(this.u("u_mlip"), ...g.mouth.lip);
    gl.uniform4f(this.u("u_mdim"), ...g.mouth.dim);
  }

  resize(width: number, height: number, pixelRatio: number) {
    const gl = this.gl;
    if (!gl) return;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    canvas.width = w;
    canvas.height = h;
    this.size = { w, h };
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.u("u_res"), w, h);

    // Like CSS object-fit: cover, zoomed and centred on the focus point, clamped to the picture.
    const { width: iw, height: ih } = this.rig.image;
    const boxAspect = w / h;
    const imgAspect = iw / ih;
    const zoom = boxAspect >= 1 ? this.framing.zoomWide : this.framing.zoomTall;
    const cw = (imgAspect > boxAspect ? ih * boxAspect : iw) / zoom;
    const ch = (imgAspect > boxAspect ? ih : iw / boxAspect) / zoom;
    const x0 = clamp(this.framing.focus[0] * iw - cw / 2, 0, iw - cw);
    const y0 = clamp(this.framing.focus[1] * ih - ch / 2, 0, ih - ch);
    gl.uniform4f(this.u("u_crop"), x0, y0, cw, ch);
  }

  render(pose: AvatarPose) {
    const gl = this.gl;
    if (!gl) return;
    const fw = this.geo.faceWidth;
    const pitch = clamp(pose.head.pitch, -1, 1);
    gl.uniform4f(
      this.u("u_head"),
      (clamp(pose.head.yaw, -1, 1) * SCALE.headYaw + pose.head.x) * fw,
      (pitch * SCALE.headPitch + pose.head.y) * fw,
      pose.head.roll,
      1 - 0.03 * pitch,
    );
    gl.uniform3f(this.u("u_torso"), pose.torso.shift * SCALE.torsoShift * fw, pose.torso.lean, pose.torso.breath);
    gl.uniform3f(
      this.u("u_hand"),
      clamp(pose.hand.x, -1.5, 1.5) * SCALE.handX,
      clamp(pose.hand.y, -1.5, 1.5) * SCALE.handY - pose.hand.penLift * 2,
      -pose.hand.penLift * SCALE.penRotation,
    );
    gl.uniform2f(this.u("u_gaze"), clamp(pose.gaze.x, -1, 1), clamp(pose.gaze.y, -1, 1));
    gl.uniform2f(this.u("u_lid"), clamp(pose.lids.left, 0, 1), clamp(pose.lids.right, 0, 1));
    const browD = (this.geo.brows[0].dim[1] + this.geo.brows[1].dim[1]) / 2;
    const browLen = (this.geo.brows[0].length + this.geo.brows[1].length) / 2;
    gl.uniform2f(
      this.u("u_brow"),
      clamp(pose.brows.raise, -1, 1) * SCALE.browRaise * browD,
      clamp(pose.brows.furrow, 0, 1) * SCALE.browFurrow * browLen,
    );
    const halfW = this.geo.mouth.dim[0];
    gl.uniform3f(this.u("u_mouth"), clamp(pose.mouth.open, 0, 1), clamp(pose.mouth.smile, -1, 1) * SCALE.smile * halfW, clamp(pose.mouth.wide, -1, 1));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }
}
