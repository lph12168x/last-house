import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scene = JSON.parse(await readFile(join(root, 'public/scenes/your-house.json'), 'utf8'));
const plan = JSON.parse(await readFile(join(root, 'plans/your-house.json'), 'utf8'));
const nodes = scene.nodes;
const byId = (id) => nodes[id];

const S = 90;
const ML = 215;
const MT = 155;
const PW = 13.6;
const PH = 11.0;
const W = ML + PW * S + 90;
const H = MT + PH * S + 225;
const X = (x) => +(ML + x * S).toFixed(2);
const Y = (z) => +(MT + z * S).toFixed(2);
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const fmt = (n) => (+n).toFixed(2).replace(/\.?0+$/, '');

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Noto Serif CJK SC','Source Han Serif SC','Microsoft YaHei',sans-serif">`);
out.push(`<defs>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f3efe7"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b9ab97" stroke-width="1"/></pattern>
<pattern id="stone" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#ded8cf"/><line x1="0" y1="8" x2="8" y2="0" stroke="#c2b9ac" stroke-width="0.7"/></pattern>
<marker id="dimArrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 4 L8 4" stroke="#555" stroke-width="1"/></marker>
</defs>`);
out.push(`<rect width="${W}" height="${H}" fill="#fbfaf7"/>`);

// ---------- floors ----------
const floorStyle = (name) => {
  if (/露台/.test(name)) return '#e6e8e1';
  if (/阳台/.test(name)) return '#e9e6dc';
  if (/客厅|卧|主卧/.test(name)) return '#f3e9db';
  return '#eceef0';
};
for (const z of Object.values(nodes)) {
  if (z.type !== 'zone' || !z.polygon || z.polygon.length < 3) continue;
  const pts = z.polygon.map(([x, zz]) => `${X(x)},${Y(zz)}`).join(' ');
  out.push(`<polygon points="${pts}" fill="${floorStyle(z.name)}" stroke="none"/>`);
}

// ---------- walls ----------
const wallEls = [];
for (const w of Object.values(nodes)) {
  if (w.type !== 'wall' || !w.start || !w.end) continue;
  const [x0, z0] = w.start;
  const [x1, z1] = w.end;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.02) continue;
  const t = w.thickness ?? 0.12;
  const ang = (Math.atan2(dz, dx) * 180) / Math.PI;
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const low = (w.height ?? 2.95) < 1.5;
  wallEls.push(
    `<rect x="${X(mx - len / 2)}" y="${Y(mz - t / 2)}" width="${len * S}" height="${t * S}" fill="${low ? '#9b9b95' : '#343433'}" transform="rotate(${ang} ${X(mx)} ${Y(mz)})" ${low ? 'stroke="#6f6f6a" stroke-width="0.6" stroke-dasharray="4 2"' : ''}/>`
  );
}
out.push(wallEls.join('\n'));

// ---------- openings ----------
function inAnyRoom(x, z) {
  for (const zone of Object.values(nodes)) {
    if (zone.type !== 'zone' || !zone.polygon) continue;
    let inside = false;
    const p = zone.polygon;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, zi] = p[i];
      const [xj, zj] = p[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

const openingEls = [];
for (const d of Object.values(nodes)) {
  if ((d.type !== 'door' && d.type !== 'window') || !d.parentId) continue;
  const w = byId(d.parentId);
  if (!w || !w.start || !w.end) continue;
  const [x0, z0] = w.start;
  const [x1, z1] = w.end;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;
  const t = w.thickness ?? 0.12;
  const half = (d.width ?? 0.9) / 2;
  const c = d.position?.[0] ?? len / 2;
  const cx = x0 + ux * c;
  const cz = z0 + uz * c;
  const ang = (Math.atan2(dz, dx) * 180) / Math.PI;
  const gapW = (half * 2) * S;
  const gapT = (t + 0.02) * S;
  openingEls.push(
    `<rect x="${(X(cx) - gapW / 2).toFixed(2)}" y="${(Y(cz) - gapT / 2).toFixed(2)}" width="${gapW.toFixed(2)}" height="${gapT.toFixed(2)}" fill="#fbfaf7" transform="rotate(${ang} ${X(cx)} ${Y(cz)})"/>`
  );
  if (d.type === 'window') {
    for (const off of [-0.045, 0, 0.045]) {
      const ox = nx * off;
      const oz = nz * off;
      openingEls.push(
        `<line x1="${X(cx - ux * half + ox)}" y1="${Y(cz - uz * half + oz)}" x2="${X(cx + ux * half + ox)}" y2="${Y(cz + uz * half + oz)}" stroke="#4d84b4" stroke-width="1.5"/>`
      );
    }
    for (const sgn of [-1, 1]) {
      openingEls.push(
        `<line x1="${X(cx + ux * half * sgn - nx * t / 2)}" y1="${Y(cz + uz * half * sgn - nz * t / 2)}" x2="${X(cx + ux * half * sgn + nx * t / 2)}" y2="${Y(cz + uz * half * sgn + nz * t / 2)}" stroke="#4d84b4" stroke-width="1.2"/>`
      );
    }
  } else {
    const p0x = cx - ux * half;
    const p0z = cz - uz * half;
    const p1x = cx + ux * half;
    const p1z = cz + uz * half;
    let side = inAnyRoom(cx + nx * 0.45, cz + nz * 0.45) ? 1 : inAnyRoom(cx - nx * 0.45, cz - nz * 0.45) ? -1 : 1;
    if (Math.abs(x0 - 10.4) < 0.01 && cz > 6.0) side = -1;
    const hx = p0x;
    const hz = p0z;
    const ex = hx + nx * side * (half * 2);
    const ez = hz + nz * side * (half * 2);
    const arc = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI / 2) * (i / steps);
      const vx = (p1x - hx) * Math.cos(a) + (ex - hx) * Math.sin(a);
      const vz = (p1z - hz) * Math.cos(a) + (ez - hz) * Math.sin(a);
      arc.push(`${X(hx + vx).toFixed(1)},${Y(hz + vz).toFixed(1)}`);
    }
    openingEls.push(`<polyline points="${arc.join(' ')}" fill="none" stroke="#9a8b78" stroke-width="0.9" stroke-dasharray="3 2"/>`);
    openingEls.push(`<line x1="${X(hx)}" y1="${Y(hz)}" x2="${X(ex)}" y2="${Y(ez)}" stroke="#6f5a42" stroke-width="1.6"/>`);
    openingEls.push(`<circle cx="${X(hx)}" cy="${Y(hz)}" r="1.6" fill="#6f5a42"/>`);
  }
}
out.push(openingEls.join('\n'));

// ---------- furniture ----------
const nameMap = {
  'sofa': '沙发', 'coffee-table': '茶几', 'tv-stand': '电视柜', 'dining-table': '餐桌', 'dining-chair': '餐椅',
  'kitchen': '橱柜', 'stove': '灶台', 'fridge': '冰箱', 'washing-machine': '洗衣机', 'drying-rack': '晾衣架',
  'double-bed': '双人床', 'bedside-table': '床头柜', 'toilet': '马桶', 'livingroom-chair': '休闲椅', 'shelf': '书架',
};
const HARD_FINISH = new Set([
  'wardrobe', 'tv-wall', 'upper-cabinet', 'pendant', 'rug', 'bookshelf', 'desk',
  'curtain', 'backsplash', 'vanity', 'mirror',
]);
const furn = [];
for (const it of Object.values(nodes)) {
  if (it.type !== 'item') continue;
  if (it.visible === false) continue;
  if (HARD_FINISH.has(it.asset?.id)) continue;
  const dims = it.asset?.dimensions ?? [1, 1, 1];
  const w = dims[0] ?? 1;
  const d = dims[2] ?? 1;
  const yaw = ((it.rotation?.[1] ?? 0) * 180) / Math.PI;
  const rot = Math.round(yaw / 90) * 90;
  const cx = it.position[0];
  const cz = it.position[2];
  const cxpx = X(cx);
  const cypx = Y(cz);
  const id = it.asset?.id;
  const label = nameMap[id] ?? id ?? '家具';
  const hw = w / 2;
  const hd = d / 2;
  const rect = (x, y, rw, rh, extra = '') =>
    `<rect x="${(cxpx + x * S).toFixed(1)}" y="${(cypx + y * S).toFixed(1)}" width="${(rw * S).toFixed(1)}" height="${(rh * S).toFixed(1)}" ${extra}/>`;
  const line = (ax, az, bx, bz, sw = 1, color = '#4a4a48') =>
    `<line x1="${(cxpx + ax * S).toFixed(1)}" y1="${(cypx + az * S).toFixed(1)}" x2="${(cxpx + bx * S).toFixed(1)}" y2="${(cypx + bz * S).toFixed(1)}" stroke="${color}" stroke-width="${sw}"/>`;
  let inner = rect(-hw, -hd, w, d, 'fill="#ffffff" fill-opacity="0.93" stroke="#4a4a48" stroke-width="1" rx="1.5"');
  if (id === 'double-bed') {
    inner += line(-hw, -hd + 0.03, hw, -hd + 0.03, 3);
    inner += rect(-hw + 0.12, -hd + 0.12, hw - 0.2, 0.32, 'fill="#ece8e0" stroke="#8a8a84" stroke-width="0.6" rx="1"');
    inner += rect(0.08, -hd + 0.12, hw - 0.2, 0.32, 'fill="#ece8e0" stroke="#8a8a84" stroke-width="0.6" rx="1"');
    inner += line(-hw, hd - 0.42, hw, hd - 0.42, 0.7);
    inner += line(0, -hd + 0.5, 0, hd - 0.45, 0.55, '#b9b4aa');
  } else if (id === 'sofa') {
    inner += line(-hw, -hd + 0.14, hw, -hd + 0.14, 4);
    inner += line(-hw + 0.14, -hd + 0.14, -hw + 0.14, hd - 0.10, 2);
    inner += line(hw - 0.14, -hd + 0.14, hw - 0.14, hd - 0.10, 2);
    inner += line(-hw + 0.2, -hd + 0.3, -0.06, -hd + 0.3, 0.5, '#c9c4ba');
    inner += line(0.06, -hd + 0.3, hw - 0.2, -hd + 0.3, 0.5, '#c9c4ba');
  } else if (id === 'dining-chair' || id === 'livingroom-chair') {
    inner += line(-hw, -hd + 0.07, hw, -hd + 0.07, 3);
    inner += line(-hw + 0.05, -hd + 0.07, -hw + 0.05, hd - 0.06, 0.8);
    inner += line(hw - 0.05, -hd + 0.07, hw - 0.05, hd - 0.06, 0.8);
  } else if (id === 'toilet') {
    inner += `<ellipse cx="${cxpx}" cy="${cypx}" rx="${(Math.min(w, d) * 0.25 * S).toFixed(1)}" ry="${(Math.min(w, d) * 0.31 * S).toFixed(1)}" fill="none" stroke="#4a4a48" stroke-width="0.8"/>`;
    inner += line(-hw + 0.08, -hd + 0.14, hw - 0.08, -hd + 0.14, 2.5);
  } else if (id === 'washing-machine') {
    inner += `<circle cx="${cxpx}" cy="${cypx}" r="${(Math.min(w, d) * 0.3 * S).toFixed(1)}" fill="none" stroke="#4a4a48" stroke-width="1"/>`;
  } else if (id === 'stove') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      inner += `<circle cx="${(cxpx + sx * hw * 0.5 * S).toFixed(1)}" cy="${(cypx + sz * hd * 0.45 * S).toFixed(1)}" r="${(0.12 * S).toFixed(1)}" fill="none" stroke="#4a4a48" stroke-width="0.8"/>`;
    }
    inner += line(-hw, hd - 0.07, hw, hd - 0.07, 1.2);
  } else if (id === 'drying-rack') {
    for (let i = -2; i <= 2; i++) inner += line(-hw + 0.06, i * 0.18, hw - 0.06, i * 0.18, 0.6);
  } else if (id === 'kitchen') {
    inner += line(-hw + 0.03, -hd + 0.08, hw - 0.03, -hd + 0.08, 1.2);
    inner += rect(-hw + 0.32, -hd + 0.16, 0.42, 0.34, 'fill="none" stroke="#4a4a48" stroke-width="0.8" rx="1"');
    inner += `<circle cx="${(cxpx + (-hw + 0.53) * S).toFixed(1)}" cy="${(cypx + (-hd + 0.33) * S).toFixed(1)}" r="2" fill="#4a4a48"/>`;
  } else if (id === 'fridge') {
    inner += line(-hw + 0.08, -hd + 0.3, hw - 0.08, -hd + 0.3, 0.6, '#b9b4aa');
    inner += `<circle cx="${(cxpx + hw * 0.55 * S).toFixed(1)}" cy="${(cypx - hd * 0.45 * S).toFixed(1)}" r="1.5" fill="#4a4a48"/>`;
  } else if (id === 'tv-stand') {
    inner += line(-hw + 0.08, -hd + 0.1, hw - 0.08, -hd + 0.1, 1);
    inner += line(-hw + 0.08, hd - 0.1, hw - 0.08, hd - 0.1, 1);
  }
  furn.push(`<g transform="rotate(${-rot} ${cxpx} ${cypx})">${inner}</g>`);
  if (label && !/餐椅|床头柜|双人床|马桶/.test(label)) {
    const dy = id === 'double-bed' ? 0.62 : 0.1;
    furn.push(`<text x="${cxpx}" y="${(cypx + dy * S).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#33322f" style="paint-order:stroke;stroke:#ffffff;stroke-width:2.5px;stroke-linejoin:round">${esc(label)}</text>`);
  }
}
out.push(furn.join('\n'));

// ---------- custom joinery ----------
const joinery = [];
for (const j of plan.joinery ?? []) {
  if (/电视柜/.test(j.name)) continue;
  const x = X(j.x0);
  const y = Y(j.z0);
  const w = (j.x1 - j.x0) * S;
  const h = (j.z1 - j.z0) * S;
  const fill = j.kind === 'stone' ? 'url(#stone)' : j.kind === 'cabinet' ? 'url(#hatch)' : '#f7f4ee';
  joinery.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="#6c6358" stroke-width="0.9"/>`);
  const lab = j.name
    .replace('电视墙石材', '电视墙')
    .replace(/^(北次卧A|北次卧B|南次卧|主卧)衣柜$/, '衣柜')
    .replace('公卫外洗手台', '洗手台')
    .replace('主卫洗手台', '洗手台');
  const vertical = h > w;
  const lx = x + w / 2;
  const ly = y + h / 2;
  joinery.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="7.5" fill="#4f473c" transform="rotate(${vertical ? -90 : 0} ${lx.toFixed(1)} ${ly.toFixed(1)})" style="paint-order:stroke;stroke:#fbfaf7;stroke-width:2px;stroke-linejoin:round">${esc(lab)}</text>`);
}
out.push(joinery.join('\n'));

// ---------- room labels ----------
const labelAt = {
  '客厅餐厅': [4.62, 6.62],
  '厨房(开放)': [6.75, 2.62],
  '封闭阳台': [8.8, 10.5],
  '主卧': [2.95, 7.0],
  '南次卧': [11.55, 7.3],
  '门厅': [3.1, 4.55],
  '公共卫生间': [1.72, 3.82],
  '主卫': [1.45, 5.78],
};
const area = (poly) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
};
const labels = [];
for (const z of Object.values(nodes)) {
  if (z.type !== 'zone' || !z.polygon || z.polygon.length < 3) continue;
  const at = labelAt[z.name];
  let lx;
  let lz;
  if (at) [lx, lz] = at;
  else {
    let sx = 0;
    let sz = 0;
    for (const [x, zz] of z.polygon) { sx += x; sz += zz; }
    lx = sx / z.polygon.length;
    lz = sz / z.polygon.length;
  }
  const a = area(z.polygon);
  const boxW = Math.max(62, z.name.length * 13 + 12);
  labels.push(`<g><rect x="${(X(lx) - boxW / 2).toFixed(1)}" y="${(Y(lz) - 17).toFixed(1)}" width="${boxW}" height="31" rx="3" fill="#ffffff" fill-opacity="0.88" stroke="#c9c4ba" stroke-width="0.6"/><text x="${X(lx)}" y="${(Y(lz) - 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#2e2d2a">${esc(z.name)}</text><text x="${X(lx)}" y="${(Y(lz) + 9).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#6b675f">${fmt(a)} ㎡</text></g>`);
}
out.push(labels.join('\n'));

// ---------- dimensions ----------
const xTicks = [0, 3.8, 10.4, 13.6];
const xDims = ['3800', '6600', '3200'];
const zTicks = [0, 1.1, 3.5, 4.9, 6.4, 9.9, 11.0];
const zDims = ['1100', '2400', '1400', '1500', '3500', '1100'];
const dim = [];
const dimY = MT - 62;
dim.push(`<line x1="${X(0)}" y1="${dimY}" x2="${X(13.6)}" y2="${dimY}" stroke="#5a5a56" stroke-width="0.8"/>`);
for (let i = 0; i < xTicks.length; i++) {
  dim.push(`<line x1="${X(xTicks[i])}" y1="${dimY - 6}" x2="${X(xTicks[i])}" y2="${dimY + 6}" stroke="#5a5a56" stroke-width="0.8"/>`);
  if (i < xDims.length) {
    const mid = (xTicks[i] + xTicks[i + 1]) / 2;
    dim.push(`<text x="${X(mid)}" y="${dimY - 7}" text-anchor="middle" font-size="10" fill="#3c3b38" font-family="monospace">${xDims[i]}</text>`);
  }
}
// extension lines
for (const t of xTicks) dim.push(`<line x1="${X(t)}" y1="${dimY + 3}" x2="${X(t)}" y2="${MT - 8}" stroke="#b7b2a8" stroke-width="0.6" stroke-dasharray="2 2"/>`);

const dimX = ML - 58;
dim.push(`<line x1="${dimX}" y1="${Y(0)}" x2="${dimX}" y2="${Y(11)}" stroke="#5a5a56" stroke-width="0.8"/>`);
for (let i = 0; i < zTicks.length; i++) {
  dim.push(`<line x1="${dimX - 6}" y1="${Y(zTicks[i])}" x2="${dimX + 6}" y2="${Y(zTicks[i])}" stroke="#5a5a56" stroke-width="0.8"/>`);
  if (i < zDims.length) {
    const mid = (zTicks[i] + zTicks[i + 1]) / 2;
    dim.push(`<text x="${dimX - 7}" y="${Y(mid)}" text-anchor="middle" font-size="10" fill="#3c3b38" font-family="monospace" transform="rotate(-90 ${dimX - 7} ${Y(mid)})">${zDims[i]}</text>`);
  }
}
for (const t of zTicks) dim.push(`<line x1="${dimX + 3}" y1="${Y(t)}" x2="${ML - 8}" y2="${Y(t)}" stroke="#b7b2a8" stroke-width="0.6" stroke-dasharray="2 2"/>`);
out.push(dim.join('\n'));

// axis bubbles
const bubbles = [];
const axisTop = MT - 108;
const xb = [['①', 0], ['③', 3.8], ['⑥', 10.4], ['⑧', 13.6]];
for (const [t, x] of xb) {
  bubbles.push(`<line x1="${X(x)}" y1="${axisTop + 12}" x2="${X(x)}" y2="${MT - 8}" stroke="#b7b2a8" stroke-width="0.6" stroke-dasharray="6 3"/>`);
  bubbles.push(`<circle cx="${X(x)}" cy="${axisTop}" r="12" fill="#fff" stroke="#6b6a64" stroke-width="0.9"/><text x="${X(x)}" y="${axisTop + 4}" text-anchor="middle" font-size="11" fill="#3c3b38">${t}</text>`);
}
const axisLeft = ML - 112;
const zb = [['Ⓖ', 0], ['Ⓕ', 1.1], ['Ⓔ', 3.5], ['Ⓓ', 4.9], ['Ⓒ', 6.4], ['Ⓑ', 9.9], ['Ⓐ', 11.0]];
for (const [t, z] of zb) {
  bubbles.push(`<line x1="${axisLeft + 12}" y1="${Y(z)}" x2="${ML - 8}" y2="${Y(z)}" stroke="#b7b2a8" stroke-width="0.6" stroke-dasharray="6 3"/>`);
  bubbles.push(`<circle cx="${axisLeft}" cy="${Y(z)}" r="12" fill="#fff" stroke="#6b6a64" stroke-width="0.9"/><text x="${axisLeft}" y="${Y(z) + 4}" text-anchor="middle" font-size="11" fill="#3c3b38">${t}</text>`);
}
out.push(bubbles.join('\n'));

// ---------- north arrow ----------
const nx = W - 55;
const ny = MT - 80;
out.push(`<g transform="translate(${nx} ${ny})"><circle r="30" fill="none" stroke="#8a877e" stroke-width="0.8"/><path d="M0 -24 L9 14 L0 7 L-9 14 Z" fill="#34332f"/><text x="0" y="-34" text-anchor="middle" font-size="10" fill="#4a4944">N</text></g>`);

// ---------- legend + title ----------
const tbW = 590;
const tbH = 176;
const tbX = W - 90 - tbW;
const tbY = H - 200;
out.push(`<rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="#fff" stroke="#8f8b82" stroke-width="1"/>`);
out.push(`<line x1="${tbX}" y1="${tbY + 44}" x2="${tbX + tbW}" y2="${tbY + 44}" stroke="#c3beb4" stroke-width="0.8"/>`);
out.push(`<text x="${tbX + 18}" y="${tbY + 27}" font-size="15" font-weight="700" fill="#24231f">平面布置图 · FURNITURE PLAN</text>`);
out.push(`<text x="${tbX + tbW - 18}" y="${tbY + 27}" text-anchor="end" font-size="11" fill="#5a564e" font-family="monospace">1 : 50</text>`);
out.push(`<text x="${tbX + 18}" y="${tbY + 66}" font-size="12" fill="#3b3934">我的小区 · 四室两厅两卫 · 143㎡ 实例</text>`);
out.push(`<text x="${tbX + 18}" y="${tbY + 87}" font-size="10.5" fill="#5f5a51">设计风格：奶油暖木 / 现代灰调 / 深色雅奢　　设计：Qoder 空间设计</text>`);
out.push(`<text x="${tbX + 18}" y="${tbY + 106}" font-size="9.5" fill="#7a756b">注：图中尺寸为轴线尺寸，单位 mm；家具与柜体为方案意向，现场复尺后深化。</text>`);
const legend = [
  ['#f3e9db', '地砖(通铺)'], ['#eceef0', '防滑地砖'], ['#ded8cf', '石材/岩板'], ['url(#hatch)', '定制柜体'], ['#4d84b4', '外窗'],
];
let lx = tbX + 18;
for (const [fill, name] of legend) {
  out.push(`<rect x="${lx}" y="${tbY + 120}" width="16" height="11" fill="${fill}" stroke="#8c877d" stroke-width="0.6"/>`);
  out.push(`<text x="${lx + 21}" y="${tbY + 129}" font-size="9.5" fill="#4c4842">${name}</text>`);
  lx += 21 + name.length * 10 + 18;
}
out.push(`<text x="${tbX + 18}" y="${tbY + 153}" font-size="9.5" fill="#7a756b">Ⓐ-Ⓖ / ①-⑧ 为建筑轴线；开口处虚线圆弧表示门扇开启方向。</text>`);

// notes left of title block
const ntX = 90;
const ntY = H - 176;
out.push(`<text x="${ntX}" y="${ntY}" font-size="12" font-weight="700" fill="#33322e">设计说明</text>`);
const notes = [
  '1. 客厅电视墙设于西侧，沙发、茶几与餐桌均南北向布置，形成"沙发—茶几—电视墙"的完整视听轴线。',
  '2. 开放式厨房沿北墙布置 2.5m 橱柜、灶台与冰箱，南侧保留 3.6m 无门洞口，餐桌退让 0.8m 留出出菜通道。',
  '3. 入户门位于东侧，餐桌与门扇保持 2.4m 距离；玄关经客厅东侧直达厨房，不穿越餐区。',
  '4. 东墙整面书柜 + 升降书桌形成第二工作区；封闭阳台西侧为洗烘区，南向 6.2m 大窗保留。',
  '5. 北向两间次卧床头靠北窗、衣柜沿南墙；主卧床头靠西，南次卧床头靠东，均避开门扇开启。',
];
notes.forEach((t, i) => out.push(`<text x="${ntX}" y="${ntY + 22 + i * 18}" font-size="10" fill="#4c4842">${esc(t)}</text>`));

out.push(`<line x1="${X(0)}" y1="${MT + PH * S + 28}" x2="${X(13.6)}" y2="${MT + PH * S + 28}" stroke="#8d887e" stroke-width="0.7"/>`);

out.push('</svg>');
const svg = out.join('\n');
await writeFile(join(root, 'public/renders/plan.svg'), svg);
console.log('wrote public/renders/plan.svg', svg.length, 'bytes');
