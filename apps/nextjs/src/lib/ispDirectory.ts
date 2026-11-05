export const ispDirectory = [
  { key: 'any', label: 'Any ISP', code: 'ANY' },
  {
    key: 'spectrum',
    label: 'Spectrum / Charter',
    code: 'Charter Communications',
  },
  {
    key: 'comcast',
    label: 'Xfinity / Comcast',
    code: 'Comcast Cable Communications',
  },
  { key: 'att', label: 'AT&T', code: 'ATT Services' },
  { key: 'verizon', label: 'Verizon', code: 'Verizon Communications' },
] as const;
export type IspPreset = (typeof ispDirectory)[number];
