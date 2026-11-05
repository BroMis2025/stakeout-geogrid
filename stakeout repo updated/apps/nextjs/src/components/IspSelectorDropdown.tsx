import { ispDirectory, type IspPreset } from '@/lib/ispDirectory';
export function IspSelectorDropdown(p: {
  stateCode: string;
  city: string;
  zip: string;
  value: IspPreset['key'];
  onChange: (key: IspPreset['key'], code: string) => void;
}) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-slate-300">
      Residential ISP · {p.city}, {p.stateCode} {p.zip}
      <select
        className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2"
        value={p.value}
        onChange={(e) => {
          const item = ispDirectory.find((i) => i.key === e.target.value)!;
          p.onChange(item.key, item.code);
        }}
      >
        {ispDirectory.map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
    </label>
  );
}
