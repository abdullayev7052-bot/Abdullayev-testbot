import { useEffect, useRef } from "react";
import L from "leaflet";

const pin = L.divIcon({ className: "", html: `<svg viewBox="0 0 24 24" width="34" height="34" style="transform:translate(-50%,-100%)"><path fill="#2563eb" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg>`, iconSize: [0, 0] });

export function LatLngPicker({ value, onChange }: { value: { lat: number; lng: number }; onChange: (v: { lat: number; lng: number }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const lat = Number(value?.lat) || 41.311, lng = Number(value?.lng) || 69.279;

  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = L.map(ref.current).setView([lat, lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    const mk = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(m);
    mk.on("dragend", () => { const p = mk.getLatLng(); cb.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); });
    m.on("click", (e: L.LeafletMouseEvent) => { mk.setLatLng(e.latlng); cb.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }); });
    map.current = m; marker.current = mk;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (marker.current && map.current) { const c = marker.current.getLatLng(); if (Math.abs(c.lat - lat) > 1e-7 || Math.abs(c.lng - lng) > 1e-7) { marker.current.setLatLng([lat, lng]); map.current.panTo([lat, lng]); } }
  }, [lat, lng]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="w-full rounded-xl border border-slate-200 overflow-hidden" style={{ height: 300 }} />
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <label>lat <input className="input !w-36 inline-block" type="number" step="0.000001" value={lat} onChange={(e) => onChange({ lat: Number(e.target.value), lng })} /></label>
        <label>lng <input className="input !w-36 inline-block" type="number" step="0.000001" value={lng} onChange={(e) => onChange({ lat, lng: Number(e.target.value) })} /></label>
        <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${lat},${lng}`}>Google'da ochish</a>
        <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://yandex.uz/maps/?pt=${lng},${lat}&z=16&l=map`}>Yandex'da ochish</a>
      </div>
      <div className="help">Xaritani bosing yoki belgini suring. Lat/Lng ni Google Maps'dan nusxalab ham qo'yish mumkin.</div>
    </div>
  );
}
