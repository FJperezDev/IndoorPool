import * as THREE from "three";

export const makeCanvasTexture = (
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  size = 256,
) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const floorTex = (() => {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#e7ecf0";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = `rgba(60,70,80,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  tex.repeat.set(6, 6);
  return tex;
})();

export const deckTex = (() => {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#cfd8de";
    ctx.fillRect(0, 0, w, h);
    const n = 4;
    const s = w / n;
    ctx.strokeStyle = "#b3bfc7";
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
  });
  tex.repeat.set(3, 3);
  return tex;
})();

export const waterTex = (() => {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#2b9fd4";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.ellipse(
        w / 2,
        y,
        w * 0.62,
        5 + Math.random() * 12,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }, 512);
  tex.repeat.set(6, 8);
  return tex;
})();
