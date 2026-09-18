import { useEffect, useRef } from "react";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { haptic } from "../lib/telegram.ts";

const pin = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;transform:translate(-50%,-100%);position:relative"><svg viewBox="0 0 24 24" width="34" height="34"><path fill="var(--primary)" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="3" fill="#fff"/></svg></div>`,
  iconSize: [0, 0],
});

export function MapPicker({ lat, lng, zoom = 13, onChange, myLocationLabel }: { lat: number; lng: number; zoom?: number; onChange: (lat: number, lng: number) => void; myLocationLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([lat, lng], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    const mk = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(m);
    mk.on("dragend", () => { const p = mk.getLatLng(); haptic.light(); cb.current(p.lat, p.lng); });
    m.on("click", (e: L.LeafletMouseEvent) => { mk.setLatLng(e.latlng); haptic.light(); cb.current(e.latlng.lat, e.latlng.lng); });
    map.current = m; marker.current = mk;
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (marker.current && map.current) {
      const cur = marker.current.getLatLng();
      if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) { marker.current.setLatLng([lat, lng]); map.current.panTo([lat, lng]); }
    }
  }, [lat, lng]);

  const locate = () => {
    haptic.medium();
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.current?.setView([latitude, longitude], 16);
      marker.current?.setLatLng([latitude, longitude]);
      cb.current(latitude, longitude);
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200" style={{ height: 240 }}>
      <div ref={ref} className="w-full h-full" />
      <button onClick={locate} className="absolute bottom-3 right-3 z-[400] px-3 py-2 rounded-xl bg-white shadow-md text-sm font-semibold flex items-center gap-1.5">
        <LocateFixed size={16} /> {myLocationLabel}
      </button>
    </div>
  );
}
