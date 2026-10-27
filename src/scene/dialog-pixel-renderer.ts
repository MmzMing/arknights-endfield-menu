import { PIXEL_TRANSITION_BEATS, transitionState } from "../lib/pixel-transition";

const VERTEX_SHADER = `#version 300 es
  in vec2 p; out vec2 viewportUV;
  void main(){ viewportUV = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  in vec2 viewportUV; out vec4 o;
  uniform sampler2D source, codeAtlas;
  uniform vec2 codeAtlasSize;
  uniform float codeLineHeight;
  uniform float codeCharacterWidth, codeGlyphWidth;
  uniform vec2 sceneSize;
  uniform float exitStrength, exitPhase, beatCount;
  const float exitAmount = 60.;
  const vec3 exitTint = vec3(157.,187.,199.)/255.;
  float h(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float lum(vec3 c){ return dot(c,vec3(.2126,.7152,.0722)); }

  struct Fragment {
    vec2 offset;
    float coverage;
    float seed;
    vec2 local;
    vec2 size;
    vec2 cell;
  };

  Fragment fragmentAt(vec2 pixel, float amount, float beat, bool coarse) {
    float height = coarse ? mix(38.,18.,amount) : mix(9.,3.,amount);
    float row = floor(pixel.y/height);
    float rowSeed = h(vec2(row,coarse ? 73. : 19.));
    float width = (coarse ? mix(100.,280.,rowSeed) : mix(24.,130.,rowSeed));
    width *= min(1.,sceneSize.x/900.);
    vec2 size = vec2(width,height);
    vec2 grid = (pixel+vec2(rowSeed*317.,0.))/size;
    vec2 cell = floor(grid);
    float seed = h(cell+vec2(beat,coarse ? 83. : 31.));
    float cluster = h(floor(pixel/vec2(220.,110.))+floor(beat/3.));
    float density = (coarse ? .32 : .9)*amount*exitStrength;
    density *= mix(.4,1.7,cluster);
    float coverage = 1.-smoothstep(density-.05,density+.05,seed);
    vec2 edge = min(fract(grid),1.-fract(grid))*size;
    coverage *= smoothstep(0.,.7,min(edge.x,edge.y));
    float variation = h(cell+vec2(beat+11.,97.));
    float direction = variation < .5 ? -1. : 1.;
    float limit = min(coarse ? 190. : 125.,sceneSize.x*.16);
    float dx = direction*mix(4.,limit,variation)*mix(.3,1.,amount);
    dx += (.5-fract(grid.x))*width*.9*step(.76,variation);
    float dy = (h(cell+47.)-.5)*(coarse ? 14. : 2.);
    return Fragment(vec2(dx,dy)*coverage*exitStrength,coverage,variation,fract(grid)*size,size,cell);
  }

  vec3 interference(vec3 base, vec3 shifted) {
    float a = lum(base), b = lum(shifted);
    float blended = abs(a-b);
    return exitTint*blended;
  }

  vec4 sampleScene(vec2 uv) {
    return texture(source,clamp(uv,vec2(0.),vec2(1.)));
  }

  vec3 composeCode(vec3 base, Fragment ribbon, float beat) {
    float selected = step(.3,ribbon.seed);
    float coverage = ribbon.coverage*selected;
    if(coverage <= .001) return base;
    float rows = codeAtlasSize.y/codeLineHeight;
    float row = floor(h(ribbon.cell+vec2(floor(beat*.5),119.))*rows);
    float stretch = mix(.9,1.18,ribbon.seed);
    vec2 textPixel = vec2(
      ribbon.local.x/stretch+ribbon.offset.x*.45+h(ribbon.cell+67.)*160.,
      ribbon.size.y-ribbon.local.y-(ribbon.size.y-codeLineHeight)*.5
    );
    float inside = smoothstep(0.,1.,textPixel.y)*(1.-smoothstep(codeLineHeight-1.,codeLineHeight,textPixel.y));
    coverage *= inside;
    textPixel.x = mod(textPixel.x,codeAtlasSize.x);
    vec2 glyphSize = vec2(codeGlyphWidth,codeLineHeight*2.);
    ivec2 entry = ivec2(floor(textPixel.x/codeCharacterWidth),glyphSize.y*6.+row);
    float character = floor(texelFetch(codeAtlas,entry,0).r*255.+.5);
    vec2 cell = vec2(mod(character,16.),floor(character/16.));
    vec2 local = vec2(mod(textPixel.x,codeCharacterWidth)+1.,clamp(textPixel.y,.5,codeLineHeight-.5))*2.;
    vec2 atlasUV = (cell*glyphSize+local)/vec2(textureSize(codeAtlas,0));
    float glyph = texture(codeAtlas,atlasUV).r*inside;
    vec2 center = (viewportUV*sceneSize-ribbon.local+ribbon.size*.5+ribbon.offset)/sceneSize;
    float light = smoothstep(.28,.7,lum(sampleScene(center).rgb));
    vec3 plate = exitTint*mix(.18,.94,light);
    plate = mix(plate,interference(base,plate),step(.6,ribbon.seed)*.12);
    vec3 ink = mix(vec3(.83,.92,.95),vec3(.055,.15,.20),step(.48,light));
    vec3 ground = mix(base,plate,.5);
    vec3 code = mix(ground,ink,glyph*.96);
    return mix(base,code,coverage*smoothstep(0.,.18,exitStrength));
  }

  float fragmentOpacity(vec2 pixel, float amount) {
    float height = mix(13.,5.,amount);
    float row = floor(pixel.y/height);
    float width = mix(28.,120.,h(vec2(row,71.)))*min(1.,sceneSize.x/900.);
    vec2 cell = floor(vec2(pixel.x/width+h(vec2(row,8.)),row));
    float cluster = h(floor(pixel/vec2(180.,90.))+53.);
    float threshold = mix(.12,.94,.6*h(cell+23.)+.4*cluster);
    float opening = smoothstep(.4,.97,exitPhase);
    float hole = smoothstep(threshold-.1,threshold+.1,opening);
    return 1.-hole*smoothstep(0.,.25,amount);
  }

  void main() {
    float amount = exitAmount*.01;
    float beat = floor(exitPhase*beatCount);
    vec2 pixel = viewportUV*sceneSize;
    Fragment fine = fragmentAt(pixel,amount,beat,false);
    Fragment coarse = fragmentAt(pixel,amount,floor(beat*.5),true);
    vec2 offset = (fine.offset+coarse.offset)/sceneSize;
    vec4 sourcePixel = sampleScene(viewportUV+offset);
    vec3 col = sourcePixel.rgb;
    float coverage = max(fine.coverage,coarse.coverage);
    if(coverage > .001) {
      vec3 echo = sampleScene(viewportUV+offset*.42).rgb;
      col = mix(col,echo,coverage*amount*exitStrength*.22);
      float accent = step(.72,fine.seed)*fine.coverage*exitStrength*.22;
      col = mix(col,interference(echo,col),accent);
    }
    col = composeCode(col,coarse,beat);
    float alpha = sourcePixel.a*fragmentOpacity(pixel,amount);
    o = vec4(col*alpha,alpha);
  }
`;

const CODE_LINES = [
  "const harness = createKimiHarness(harnessOptions);",
  "await tui.start();",
  "this.intervalId = setInterval(() => {",
  "this.currentFrame = (this.currentFrame + 1) % this.frames.length;",
  "this.updateDisplay();",
  "}, this.interval);",
  "0x003F  0xA128  0x007E  0xF340  00110110  11001001  0x09BC  10101010",
  "this._assistantDraft += delta;",
  "this.pendingAssistantFlush = true;",
  "block.entry.content = fullText;",
  "block.component.updateContent(fullText, { transient: true });",
  "this.host.state.ui.requestRender();",
  "01001101  01101001  00110011  0x2F10  0xC8A4  11100010  0x00FF",
  "const group = this.upgradeSoloAgentToGroup(solo);",
  "group.attach(toolCall.id, tc);",
  "state.ui.requestRender();",
  "const keyArg = extractKeyArgument(toolName, args, workspaceDir);",
  "return keyArg ? `${verb} ${toolName} (${keyArg})` : `${verb} ${toolName}`;",
  "0xE07A  11010001  0x5B20  00101100  0xAA91  10001011  0xF003",
  "notifyTerminalOnce(state, `turn-complete:${completedTurnKey}`, {",
  "title: 'Kimi Code task complete',",
  "body: state.appState.sessionTitle ?? undefined,",
  "});",
  "0x0010  0x0020  0x0040  0x0080  0x0100  0x0200  0x0400  0x0800",
];

export type DialogPixelRenderer = {
  draw: (phase: number) => void;
  destroy: () => void;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Pixel shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Pixel shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Pixel program allocation failed");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "p");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Pixel program linking failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createTexture(gl: WebGL2RenderingContext, unit: number): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Pixel texture allocation failed");
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function uploadCodeAtlas(gl: WebGL2RenderingContext, program: WebGLProgram): void {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Pixel code texture preparation failed");
  context.font = "500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const characterWidth = context.measureText("M").width;
  const glyphWidth = 2 * Math.ceil(characterWidth + 2);
  canvas.width = 16 * glyphWidth;
  canvas.height = 192;
  context.scale(2, 2);
  context.font = "500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  context.fillStyle = "#fff";
  context.textBaseline = "middle";
  for (let index = 0; index < 95; index += 1) {
    context.fillText(String.fromCharCode(index + 32), (index % 16) * glyphWidth / 2 + 1, (Math.floor(index / 16) + 0.5) * 16);
  }
  const width = canvas.width;
  const height = canvas.height + CODE_LINES.length;
  const source = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = new Uint8Array(width * height);
  for (let index = 0; index < source.length / 4; index += 1) pixels[index] = source[index * 4 + 3] ?? 0;
  CODE_LINES.forEach((line, row) => {
    for (let index = 0; index < line.length; index += 1) {
      pixels[(canvas.height + row) * width + index] = line.charCodeAt(index) - 32;
    }
  });
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
  gl.uniform2f(gl.getUniformLocation(program, "codeAtlasSize"), 512, 16 * CODE_LINES.length);
  gl.uniform1f(gl.getUniformLocation(program, "codeLineHeight"), 16);
  gl.uniform1f(gl.getUniformLocation(program, "codeCharacterWidth"), characterWidth);
  gl.uniform1f(gl.getUniformLocation(program, "codeGlyphWidth"), glyphWidth);
}

export function createDialogPixelRenderer(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
): DialogPixelRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("WebGL 2 is unavailable");
  canvas.width = source.width;
  canvas.height = source.height;
  const program = createProgram(gl);
  gl.useProgram(program);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  const sourceTexture = createTexture(gl, 0);
  const atlasTexture = createTexture(gl, 1);
  if (!vao || !buffer) throw new Error("Pixel geometry allocation failed");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  uploadCodeAtlas(gl, program);
  gl.uniform1i(gl.getUniformLocation(program, "source"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "codeAtlas"), 1);
  gl.uniform2f(gl.getUniformLocation(program, "sceneSize"), source.width, source.height);
  gl.uniform1f(gl.getUniformLocation(program, "beatCount"), PIXEL_TRANSITION_BEATS);

  return {
    draw(phase) {
      const state = transitionState(phase);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(program, "exitStrength"), state.strength);
      gl.uniform1f(gl.getUniformLocation(program, "exitPhase"), state.phase);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(sourceTexture);
      gl.deleteTexture(atlasTexture);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      // 浏览器对同时存在的 WebGL 上下文有上限，反复开关弹窗必须显式归还。
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

const imageCache = new Map<string, Promise<string | null>>();
const SNAPSHOT_IMAGE_MAX_WIDTH = 1280;

/** 封面只用于 400ms 转场，按 2x 展示宽度重编码，避免把原图整份塞进 SVG 拖慢首次解码。 */
async function shrinkImage(bytes: Uint8Array, type: string): Promise<string> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type }));
    const scale = Math.min(1, SNAPSHOT_IMAGE_MAX_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return bytesToDataUrl(bytes, type);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/webp", 0.86);
  } catch {
    return bytesToDataUrl(bytes, type);
  }
}

function cacheImage(url: string): Promise<string | null> {
  const absolute = new URL(url, window.location.href).href;
  let pending = imageCache.get(absolute);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(absolute);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return await shrinkImage(bytes, response.headers.get("content-type") ?? "image/webp");
      } catch {
        return null;
      }
    })();
    imageCache.set(absolute, pending);
  }
  return pending;
}

/** 菜单空闲 / 首次启动时预取封面：取图 + webp 重编码都提前跑完。 */
export function warmDialogImages(urls: string[]): Promise<void> {
  return Promise.all(urls.map((url) => cacheImage(url))).then(() => undefined);
}

const CSS_URL = /url\((["']?)([^"')]+)\1\)/g;

/** 弹窗实际使用的字体家族；其余字体不进入快照。 */
const DIALOG_FONT_FAMILIES = new Set(["Noto Sans SC", "Rajdhani", "JetBrains Mono"]);

function bytesToDataUrl(bytes: Uint8Array, type: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

type FontFaceEntry = {
  cssText: string;
  urls: string[];
  ranges: [number, number][] | null;
};

type CssIndex = { base: string; faces: FontFaceEntry[] };

function parseUnicodeRange(value: string): [number, number][] | null {
  if (!value) return null;
  const ranges: [number, number][] = [];
  for (const part of value.split(",")) {
    const match = /u\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!match?.[1]) continue;
    const start = match[1];
    const low = parseInt(start.replace(/\?/g, "0"), 16);
    const high = parseInt((match[2] ?? start).replace(/\?/g, "f"), 16);
    if (Number.isFinite(low) && Number.isFinite(high)) ranges.push([low, high]);
  }
  return ranges.length > 0 ? ranges : null;
}

function buildCssIndex(): CssIndex {
  let base = "";
  const faces: FontFaceEntry[] = [];
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) {
        base += `${rule.cssText}\n`;
        continue;
      }
      const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      if (!DIALOG_FONT_FAMILIES.has(family)) continue;
      const urls = Array.from(rule.cssText.matchAll(CSS_URL), (match) => {
        const path = match[2];
        return path ? new URL(path, window.location.href).href : "";
      });
      if (urls.length === 0 || urls.some((url) => !url)) continue;
      faces.push({
        cssText: rule.cssText,
        urls,
        ranges: parseUnicodeRange(rule.style.getPropertyValue("unicode-range")),
      });
    }
  }
  return { base, faces };
}

let cssIndexPromise: Promise<CssIndex> | null = null;
const fontDataCache = new Map<string, Promise<string | null>>();
const dialogCssCache = new Map<string, Promise<string>>();

function getCssIndex(): Promise<CssIndex> {
  cssIndexPromise ??= Promise.resolve().then(buildCssIndex);
  return cssIndexPromise;
}

function getFontData(url: string): Promise<string | null> {
  let pending = fontDataCache.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytesToDataUrl(bytes, "font/woff2");
      } catch {
        return null;
      }
    })();
    fontDataCache.set(url, pending);
  }
  return pending;
}

function fontCoversText(face: FontFaceEntry, codePoints: ReadonlySet<number>): boolean {
  if (!face.ranges) return true;
  for (const codePoint of codePoints) {
    if (face.ranges.some(([low, high]) => codePoint >= low && codePoint <= high)) return true;
  }
  return false;
}

function codePointsOf(text: string): Set<number> {
  return new Set(Array.from(text, (char) => char.codePointAt(0) ?? 0));
}

const SNAPSHOT_TEXT_MARGIN = 64;

/** 元素是否被某个裁剪祖先（overflow 非 visible）整块裁到可视区外；留 SNAPSHOT_TEXT_MARGIN 余量。 */
function clippedOutside(rect: DOMRect, element: HTMLElement, source: HTMLElement): boolean {
  const outside = (clip: DOMRect) =>
    rect.bottom < clip.top - SNAPSHOT_TEXT_MARGIN ||
    rect.top > clip.bottom + SNAPSHOT_TEXT_MARGIN ||
    rect.right < clip.left - SNAPSHOT_TEXT_MARGIN ||
    rect.left > clip.right + SNAPSHOT_TEXT_MARGIN;
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      if (outside(node.getBoundingClientRect())) return true;
    }
    if (node === source) break;
    node = node.parentElement;
  }
  return outside(source.getBoundingClientRect());
}

/** 快照只画可见区域：字体子集按“会被画出来的文字”挑选。长列表弹窗（订阅）整列表文字有八千字，
    按全量挑子集会让内嵌字体涨到 3MB、SVG 解码 220ms 以上，入场动效因此永远来不及接入。
    滚动容器外的行不参与挑选（它们在快照里被裁掉），行高由 nowrap + 固定 padding 决定，换字体不改布局。 */
function visibleTextOf(source: HTMLElement): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node !== null) {
    const element = node as HTMLElement;
    if (element.firstElementChild === null) {
      const text = element.textContent ?? "";
      if (text.trim().length > 0 && !clippedOutside(element.getBoundingClientRect(), element, source)) {
        parts.push(text);
      }
    }
    node = walker.nextNode();
  }
  return parts.join("\n");
}

async function getDialogCss(text: string): Promise<string> {
  const { base, faces } = await getCssIndex();
  const selected = faces.filter((face) => fontCoversText(face, codePointsOf(text)));
  const urls = Array.from(new Set(selected.flatMap((face) => face.urls))).sort();
  const key = urls.join("|");
  let pending = dialogCssCache.get(key);
  if (!pending) {
    pending = (async () => {
      const embedded = new Map(await Promise.all(urls.map(async (url) => [url, await getFontData(url)] as const)));
      let css = base;
      for (const face of selected) {
        if (face.urls.some((url) => !embedded.get(url))) continue;
        css += `${face.cssText.replace(CSS_URL, (source, _quote: string, path: string) => {
          const dataUrl = embedded.get(new URL(path, window.location.href).href);
          return dataUrl ? `url("${dataUrl}")` : source;
        })}\n`;
      }
      return css;
    })();
    dialogCssCache.set(key, pending);
  }
  return pending;
}

/** 解析样式表与字体族索引，弹窗打开时只取当前文字覆盖的子集。 */
export function warmDialogSnapshot(): Promise<void> {
  return getCssIndex().then(() => undefined);
}

/** 预取文案覆盖的字体子集（转 base64 供快照 SVG 内嵌），并让文档字面量提前加载对应字重，
    打开弹窗时 rasterizeDialog 里的 fonts.ready 不再等网络。 */
export function warmDialogFonts(texts: string[]): Promise<void> {
  const text = texts.join("");
  return (async () => {
    await Promise.all(
      Array.from(DIALOG_FONT_FAMILIES, (family) =>
        document.fonts.load(`16px "${family}"`, text).catch(() => []),
      ),
    );
    const { faces } = await getCssIndex();
    const codePoints = codePointsOf(text);
    const urls = new Set<string>();
    for (const face of faces) {
      if (fontCoversText(face, codePoints)) {
        for (const url of face.urls) urls.add(url);
      }
    }
    await Promise.all(Array.from(urls, (url) => getFontData(url)));
  })();
}

/** 预热 WebGL 管线：一次性上下文里编译同一套着色器并跑一帧，摊掉首次打开时的同步编译与上下文初始化。 */
export function warmDialogRenderer(): Promise<void> {
  return Promise.resolve().then(() => {
    const source = document.createElement("canvas");
    source.width = 16;
    source.height = 16;
    const context = source.getContext("2d");
    if (!context) return;
    context.fillStyle = "#e7e7e2";
    context.fillRect(0, 0, 16, 16);
    const canvas = document.createElement("canvas");
    try {
      const renderer = createDialogPixelRenderer(canvas, source);
      renderer.draw(0.5);
      renderer.destroy();
    } catch {
      // 无 WebGL2 的环境打开弹窗时本就走静态面板，预热失败无需处理。
    }
  });
}

export async function rasterizeDialog(sourceElement: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const width = sourceElement.offsetWidth;
  const height = sourceElement.offsetHeight;
  // 快照 SVG 的视口必须等于真实视口，vw/vh 与媒体查询才会和落位后的 DOM 算出同一套字号。
  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.style.opacity = "1";
  clone.style.visibility = "visible";
  clone.style.margin = "0";
  const sourceImages = Array.from(sourceElement.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  await Promise.all(sourceImages.map(async (image, index) => {
    const sourceUrl = image.currentSrc || image.src;
    const dataUrl = sourceUrl ? await cacheImage(sourceUrl) : null;
    const cloned = cloneImages[index];
    if (dataUrl && cloned) cloned.src = dataUrl;
  }));
  clone.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  const css = await getDialogCss(visibleTextOf(sourceElement));
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewportWidth}" height="${viewportHeight}"><foreignObject width="100%" height="100%"><style><![CDATA[${css}]]></style><div xmlns="http://www.w3.org/1999/xhtml" style="position:absolute;left:0;top:0;width:${width}px;height:${height}px">${serialized}</div></foreignObject></svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Dialog rasterization is unavailable");
  context.scale(ratio, ratio);
  context.drawImage(image, 0, 0, width, height, 0, 0, width, height);
  return canvas;
}
