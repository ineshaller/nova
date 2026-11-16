import { MONTHS } from "./constants.js";

export const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

// "2026-11-16" → Date locale (sans décalage de fuseau)
export const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const endOf = (e) => toDate(e.end || e.start);
export const isPast = (e) => endOf(e) < today();

export const fmtDate = (dt) => `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;

export function fmtRange(e) {
  if (e.status === "year") return "Toute l'année scolaire";
  const a = toDate(e.start), b = e.end ? toDate(e.end) : null;
  if (!b) return fmtDate(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()} – ${fmtDate(b)}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${fmtDate(b)}`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Recherche sans accents ni majuscules
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const matches = (query, parts) => {
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm(parts.join(" "));
  return q.split(/\s+/).every((w) => hay.includes(w));
};

// Le champ "mixite" peut contenir <b>…</b> : on échappe tout le reste.
export function safeBold(text) {
  const esc = String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return esc.replace(/&lt;(\/?)b&gt;/g, "<$1b>");
}
