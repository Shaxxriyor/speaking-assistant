export const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/**
 * Single-pass photo rig. For each output pixel it computes where to sample the reference picture, applying (in
 * inverse order) hand, torso and head motion with soft region masks, then local face deformations (brows, irises,
 * smile, lip shape, jaw opening) and finally draws eyelids over the eyes. The room outside the masks never moves.
 */
export const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_img;
uniform vec4 u_crop;

uniform vec2 u_torsoC;
uniform vec2 u_torsoR;
uniform float u_deskY;
uniform vec3 u_torso;      // shift px, lean, breath

uniform vec2 u_headC;
uniform float u_headR;
uniform vec2 u_pivot;
uniform vec4 u_head;       // tx px, ty px, roll rad, vertical scale (pitch foreshortening)

uniform vec2 u_handC;
uniform float u_handR;
uniform vec2 u_wrist;
uniform vec3 u_hand;       // tx px, ty px, rotation rad

uniform vec2 u_ec[2];
uniform vec2 u_ex[2];
uniform vec4 u_edim[2];    // half-width, lid top (incl. lashes), bottom, distance to brow
uniform vec2 u_iris[2];    // iris centre in eye-local coordinates
uniform float u_irisR[2];
uniform vec2 u_lid;        // closure per eye
uniform vec2 u_gaze;       // -1..1

uniform vec2 u_bc[2];
uniform vec2 u_bx[2];
uniform vec3 u_bdim[2];    // half-length, distance to eye top, +1/-1 direction of the inner end along u_bx
uniform vec2 u_brow;       // raise px, furrow px

uniform vec2 u_mc;
uniform vec2 u_mx;
uniform vec2 u_mlip;
uniform vec4 u_mdim;       // half-width, upper lip, lower lip, chin distance
uniform vec3 u_mouth;      // open, smile px, wide

vec2 down(vec2 a) { vec2 n = vec2(-a.y, a.x); return n.y < 0.0 ? -n : n; }
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 tex(vec2 p) { return texture2D(u_tex, clamp(p / u_img, 0.0, 1.0)).rgb; }

void main() {
  vec2 uv = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y);
  vec2 p = u_crop.xy + uv * u_crop.zw;

  // Writing hand: moves/rotates around the wrist.
  float wHand = 1.0 - smoothstep(u_handR * 0.55, u_handR * 1.15, length(p - u_handC));
  if (wHand > 0.0) p = mix(p, u_wrist + rot(p - u_wrist - u_hand.xy, -u_hand.z), wHand);

  // Torso and head ride together (breathing, lean, weight shift); forearms on the desk stay put.
  vec2 tn = (p - u_torsoC) / u_torsoR;
  float wBody = max(1.0 - smoothstep(0.7, 1.25, length(tn)), 1.0 - smoothstep(u_headR * 0.9, u_headR * 1.8, length(p - u_headC)));
  wBody *= 1.0 - smoothstep(u_deskY - 70.0, u_deskY - 5.0, p.y);
  if (wBody > 0.0) {
    vec2 anchor = vec2(u_torsoC.x, u_deskY);
    float sc = 1.0 + u_torso.y * 0.02;
    vec2 t = vec2(u_torso.x, u_torso.y * 3.0 - u_torso.z * 1.2);
    vec2 q = anchor + (p - anchor - t) / vec2(sc, sc * (1.0 + u_torso.z * 0.004));
    p = mix(p, q, wBody);
  }

  // Head: turn/nod (translation + foreshortening) and tilt around the neck.
  float wHead = 1.0 - smoothstep(u_headR * 0.75, u_headR * 1.6, length(p - u_headC));
  if (wHead > 0.0) {
    vec2 d = rot(p - u_pivot - u_head.xy, -u_head.z);
    d.y /= u_head.w;
    p = mix(p, u_pivot + d, wHead);
  }

  vec2 disp = vec2(0.0);

  // Eyebrows: raise and inner-brow furrow, fading out before the eye.
  for (int i = 0; i < 2; i++) {
    vec2 bx = u_bx[i];
    vec2 by = down(bx);
    vec2 r = vec2(dot(p - u_bc[i], bx), dot(p - u_bc[i], by));
    float hl = u_bdim[i].x, de = u_bdim[i].y, z = u_bdim[i].z;
    float w = (1.0 - smoothstep(hl * 1.1, hl * 1.7, abs(r.x)))
      * smoothstep(-de * 1.8, -de * 0.7, r.y) * (1.0 - smoothstep(de * 0.3, de * 0.7, r.y));
    float inner = clamp(0.5 + 0.5 * r.x * z / hl, 0.0, 1.0);
    disp += (-by * u_brow.x + (bx * z + by * 0.6) * u_brow.y * inner) * w;
  }

  // Irises follow the gaze inside the eye opening.
  for (int i = 0; i < 2; i++) {
    vec2 ex = u_ex[i];
    vec2 ey = down(ex);
    vec2 r = vec2(dot(p - u_ec[i], ex), dot(p - u_ec[i], ey));
    float xn = r.x / u_edim[i].x;
    if (abs(xn) < 1.0) {
      float pr = sqrt(1.0 - xn * xn);
      float top = -u_edim[i].y / 1.35 * pr;
      float bot = u_edim[i].z * pr;
      float inside = smoothstep(top - 1.0, top + 1.5, r.y) * (1.0 - smoothstep(bot - 1.5, bot + 1.0, r.y));
      vec2 g = vec2(u_gaze.x * u_edim[i].x * 0.3, u_gaze.y * (u_edim[i].z + u_edim[i].y / 1.35) * 0.22);
      float wi = (1.0 - smoothstep(u_irisR[i] * 1.1, u_irisR[i] * 2.3, length(r - (u_iris[i] + g)))) * inside;
      disp += (ex * g.x + ey * g.y) * wi;
    }
  }

  // Smile (corners up/out) and lip spread/rounding.
  vec2 my = down(u_mx);
  float halfW = u_mdim.x, upT = u_mdim.y, loT = u_mdim.z, chinD = u_mdim.w;
  for (int k = 0; k < 2; k++) {
    float side = k == 0 ? -1.0 : 1.0;
    vec2 corner = u_mc + u_mx * side * halfW;
    vec2 dc = p - corner;
    float w = exp(-dot(dc, dc) / (halfW * halfW * 0.28));
    disp += (u_mx * side * 0.35 - my) * u_mouth.y * w;
  }
  vec2 qm = p - u_mc;
  disp += u_mx * dot(qm, u_mx) * u_mouth.z * 0.08 * exp(-dot(qm, qm) / (halfW * halfW * 1.6));

  vec2 ps = p - disp;

  // Jaw/lip opening along the (curved, possibly off-centre) lip line, with a shaded mouth interior.
  vec2 q = vec2(dot(ps - u_mc, u_mx), dot(ps - u_mc, my));
  float xn = q.x / halfW;
  float xi = u_mlip.x;
  float uu = xn < xi ? (xn - xi) / (1.0 + xi) : (xn - xi) / (1.0 - xi);
  float prof2 = abs(xn) < 1.0 ? max(0.0, 1.0 - uu * uu) : 0.0;
  float prof = sqrt(prof2);
  float lipLine = u_mlip.y * prof2;
  q.y -= lipLine;
  float open = u_mouth.x;
  float gapMax = open * loT * 0.8;
  float lipGap = gapMax * prof;
  float jx = xn - xi;
  float jawGap = gapMax * exp(-jx * jx * 0.35);
  float lift0 = lipGap * 0.22;
  float srcY;
  if (q.y < 0.0) {
    srcY = q.y + lift0 * (1.0 - smoothstep(0.0, upT * 2.5, -q.y));
  } else {
    float g = mix(lipGap, jawGap, smoothstep(0.0, loT * 1.2, q.y));
    float fall = 1.0 - smoothstep(chinD, chinD * 1.9, q.y);
    float lateral = 1.0 - smoothstep(1.5, 2.4, abs(jx));
    srcY = q.y - g * fall * lateral;
  }
  vec3 col = tex(u_mc + u_mx * q.x + my * (srcY + lipLine));

  float inside = smoothstep(-lift0 - 1.0, -lift0 + 1.0, q.y) * (1.0 - smoothstep(lipGap - 1.0, lipGap + 1.0, q.y));
  if (inside > 0.0 && lipGap > 0.3) {
    float t = clamp((q.y + lift0) / (lipGap + lift0), 0.0, 1.0);
    vec3 mouth = mix(vec3(0.34, 0.12, 0.13), vec3(0.07, 0.02, 0.03), smoothstep(0.0, 0.55, t));
    mouth = mix(mouth, vec3(0.30, 0.10, 0.11), smoothstep(0.75, 1.0, t));
    float teeth = (1.0 - smoothstep(0.12, 0.3, t)) * smoothstep(0.3, 0.7, open) * smoothstep(0.2, 0.7, prof);
    mouth = mix(mouth, vec3(0.80, 0.76, 0.72) * (0.6 + 0.3 * prof) * (1.0 - 0.35 * t / 0.3), teeth * 0.85);
    mouth *= 0.55 + 0.45 * prof;
    col = mix(col, mouth, inside * smoothstep(0.0, 0.25, prof));
  }

  // Eyelids: lid skin (sampled between lashes and brow) slides down with a lash line on its edge.
  for (int i = 0; i < 2; i++) {
    float closure = i == 0 ? u_lid.x : u_lid.y;
    vec2 ex = u_ex[i];
    vec2 ey = down(ex);
    vec2 r = vec2(dot(p - u_ec[i], ex), dot(p - u_ec[i], ey));
    float xn2 = r.x / u_edim[i].x;
    if (closure > 0.001 && abs(xn2) < 1.0) {
      float pr = sqrt(1.0 - xn2 * xn2);
      float bt = u_edim[i].y;
      float top = -bt * pr;
      float bot = u_edim[i].z * pr;
      float lid = top + closure * (bot - top);
      float w = 1.0 - smoothstep(0.75, 1.0, abs(xn2));
      float t = clamp((r.y - top) / max(lid - top, 0.5), 0.0, 1.0);
      vec2 sp = u_ec[i] + ex * r.x + ey * (-u_edim[i].w * 0.6 + (r.y - top) * 0.12);
      vec3 skin = vec3(0.0);
      for (int k = -3; k <= 3; k++) skin += tex(sp + ex * float(k) * 3.0);
      skin = skin / 7.0 * mix(1.0, 0.8, t * t);
      float cover = w * smoothstep(top - 1.0, top + 0.5, r.y) * (1.0 - smoothstep(lid - 0.8, lid + 0.8, r.y));
      float lash = w * smoothstep(0.08, 0.3, closure) * exp(-pow((r.y - lid) / (1.2 + bt * 0.07), 2.0));
      vec3 lidCol = mix(skin, vec3(0.09, 0.06, 0.06), lash / max(cover + lash, 0.001));
      col = mix(col, lidCol, max(cover, lash * 0.85));
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
