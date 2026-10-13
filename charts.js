/* global VQE */
'use strict';

window.VQECharts = (() => {
  const font = '9px "SFMono-Regular", Consolas, monospace';
  function palette() {
    const css = getComputedStyle(document.documentElement);
    const read = name => css.getPropertyValue(name).trim();
    return { text: read('--muted'), faint: read('--faint'), grid: read('--grid'), accent: read('--accent'), violet: read('--violet'), green: read('--green'), panel: read('--panel') };
  }
  function prepare(canvas) {
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 1 || height < 1) return null;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    return { ctx, width, height, colors: palette() };
  }
  function format(value) {
    if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(1);
    return value.toFixed(Math.abs(value) < 10 ? 2 : 0);
  }
  function line(canvas, series, { reference, maxX = 100, xOffset = 0, label = 'ENERGY', fill = true } = {}) {
    const plot = prepare(canvas);
    if (!plot) return;
    const { ctx, width, height, colors } = plot;
    const left = 60, right = width - 18, top = 19, bottom = height - 38;
    const values = series.flatMap(s => s.values);
    if (Number.isFinite(reference)) values.push(reference);
    if (!values.length) {
      ctx.fillStyle = colors.faint; ctx.textAlign = 'center';
      ctx.fillText('Run an experiment to compare trajectories.', width / 2, height / 2);
      return;
    }
    let min = Math.min(...values), max = Math.max(...values);
    const margin = Math.max((max - min) * 0.14, 0.05);
    min -= margin; max += margin;
    const x = i => left + i / Math.max(1, maxX) * (right - left);
    const y = v => bottom - (v - min) / (max - min) * (bottom - top);
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = min + (max - min) * i / 4, py = y(value);
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
      ctx.fillStyle = colors.faint; ctx.fillText(format(value), left - 12, py + 3);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const value = Math.round(maxX * i / 4);
      ctx.fillStyle = colors.faint; ctx.fillText(String(value + xOffset), x(value), bottom + 17);
    }
    ctx.fillText('ITERATION', (left + right) / 2, height - 4);
    ctx.save(); ctx.translate(12, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore();
    if (Number.isFinite(reference)) {
      ctx.setLineDash([4, 5]); ctx.strokeStyle = colors.green; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y(reference)); ctx.lineTo(right, y(reference)); ctx.stroke(); ctx.setLineDash([]);
    }
    series.forEach((s, index) => {
      const color = s.color || [colors.accent, colors.violet, colors.green][index % 3];
      if (!s.values.length) return;
      if (fill && index === 0 && s.values.length > 1) {
        const gradient = ctx.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, color + '25'); gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(x(0), bottom);
        s.values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
        ctx.lineTo(x(s.values.length - 1), bottom); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = color; ctx.lineWidth = index === 0 ? 2 : 1.3;
      ctx.beginPath(); s.values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))); ctx.stroke();
      const end = s.values.length - 1;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(end), y(s.values[end]), 3, 0, VQE.TAU); ctx.fill();
    });
    return { left, right, maxX };
  }

  function probabilities(canvas, values, qubits) {
    const plot = prepare(canvas);
    if (!plot) return;
    const { ctx, width, height, colors } = plot;
    const sorted = values.map((value, i) => ({ value, label: i.toString(2).padStart(qubits, '0') }));
    if (values.length > 8) sorted.sort((a, b) => b.value - a.value);
    const items = sorted.slice(0, 8), left = 44, right = width - 12, top = 24, bottom = height - 31;
    ctx.textAlign = 'right';
    for (const tick of [0, 0.5, 1]) {
      const y = bottom - tick * (bottom - top);
      ctx.strokeStyle = colors.grid; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = colors.faint; ctx.fillText(`${tick * 100}%`, left - 7, y + 3);
    }
    const step = (right - left) / items.length, bar = Math.min(36, step * 0.52);
    items.forEach(({ value, label }, i) => {
      const x = left + (i + 0.5) * step, y = bottom - value * (bottom - top);
      ctx.fillStyle = i % 2 ? colors.violet : colors.accent;
      ctx.globalAlpha = 0.85; ctx.fillRect(x - bar / 2, y, bar, bottom - y); ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = colors.text;
      ctx.fillText(`${(value * 100).toFixed(0)}%`, x, Math.max(top - 4, y - 8));
      ctx.fillStyle = colors.faint; ctx.fillText(label, x, bottom + 18);
    });
    canvas.setAttribute('aria-label', `Current probabilities${values.length > 8 ? ', eight most likely states' : ''}: ${items.map(i => `${i.label}: ${(i.value * 100).toFixed(2)} percent`).join('; ')}`);
  }

  const stops = [[41, 36, 63], [104, 92, 162], [202, 137, 159], [239, 195, 147]];
  function colorAt(t) {
    const at = Math.max(0, Math.min(0.9999, t)) * 3, index = Math.floor(at), mix = at - index;
    return stops[index].map((v, i) => Math.round(v + mix * (stops[index + 1][i] - v)));
  }
  function landscape(canvas, data, trajectory, sliceX, sliceY, axes = false) {
    const plot = prepare(canvas);
    if (!plot || !data) return;
    const { ctx, width, height, colors } = plot;
    const left = axes ? 48 : 0, top = axes ? 10 : 0, right = width - (axes ? 15 : 0), bottom = height - (axes ? 42 : 0);
    const size = data.size, cw = (right - left) / size, ch = (bottom - top) / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const value = data.values[y * size + x];
      ctx.fillStyle = `rgb(${colorAt((value - data.min) / Math.max(1e-12, data.max - data.min)).join(',')})`;
      ctx.fillRect(left + x * cw, top + (size - 1 - y) * ch, cw + 0.5, ch + 0.5);
    }
    // Linear isolines over the sampled surface; no extra synthetic data.
    ctx.lineWidth = 0.7; ctx.strokeStyle = '#ffffff38';
    for (let level = 1; level < 10; level++) {
      const threshold = data.min + (data.max - data.min) * level / 10;
      ctx.beginPath();
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const cross = [];
        for (let edge = 0; edge < 4; edge++) {
          const a = corners[edge], b = corners[(edge + 1) % 4];
          const va = data.values[a[1] * size + a[0]], vb = data.values[b[1] * size + b[0]];
          if ((va < threshold) === (vb < threshold)) continue;
          const t = (threshold - va) / (vb - va);
          cross.push([left + (a[0] + t * (b[0] - a[0]) + 0.5) * cw, bottom - (a[1] + t * (b[1] - a[1]) + 0.5) * ch]);
        }
        for (let i = 0; i + 1 < cross.length; i += 2) { ctx.moveTo(...cross[i]); ctx.lineTo(...cross[i + 1]); }
      }
      ctx.stroke();
    }
    const wrap = angle => ((angle + Math.PI) % VQE.TAU + VQE.TAU) % VQE.TAU - Math.PI;
    const points = trajectory.map(row => [wrap(row.parameters[sliceX]), wrap(row.parameters[sliceY])]);
    const px = v => left + (v + Math.PI) / VQE.TAU * (right - left), py = v => bottom - (v + Math.PI) / VQE.TAU * (bottom - top);
    ctx.strokeStyle = '#fff0df'; ctx.lineWidth = 1.8; ctx.beginPath();
    points.forEach((p, i) => {
      const prev = points[i - 1];
      if (!i || Math.abs(p[0] - prev[0]) > Math.PI || Math.abs(p[1] - prev[1]) > Math.PI) ctx.moveTo(px(p[0]), py(p[1]));
      else ctx.lineTo(px(p[0]), py(p[1]));
    }); ctx.stroke();
    if (points.length) {
      const last = points.at(-1), first = points[0];
      ctx.fillStyle = '#fff0df'; ctx.beginPath(); ctx.arc(px(first[0]), py(first[1]), 2, 0, VQE.TAU); ctx.fill();
      ctx.fillStyle = colors.accent; ctx.strokeStyle = '#fff0df'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(last[0]), py(last[1]), 4, 0, VQE.TAU); ctx.fill(); ctx.stroke();
    }
    if (axes) {
      ctx.fillStyle = colors.faint; ctx.textAlign = 'center';
      ['−π', '0', 'π'].forEach((label, i) => ctx.fillText(label, left + i / 2 * (right - left), bottom + 18));
      ctx.fillText(`θ${sliceX} (rad)`, (left + right) / 2, height - 5);
      ctx.textAlign = 'right'; ['−π', '0', 'π'].forEach((label, i) => ctx.fillText(label, left - 10, bottom - i / 2 * (bottom - top) + 3));
      ctx.save(); ctx.translate(10, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(`θ${sliceY} (rad)`, 0, 0); ctx.restore();
    }
  }
  return { palette, line, probabilities, landscape };
})();
