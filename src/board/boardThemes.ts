export type SurfaceKind = 'wood' | 'marble' | 'stone' | 'lacquer';

export interface BoardTheme {
  id: string;
  /** Thin inlay line between the squares and the frame (3D). */
  inlay?: string;
  name: string;
  light: string;
  dark: string;
  frame: string;
  frameDark: string;
  coord: string;
  surface: SurfaceKind;
  frameSurface: SurfaceKind;
  /** 3D surface polish */
  roughness: number;
  clearcoat: number;
  /** Highlight colours */
  lastMove: string;
  selected: string;
  check: string;
  hint: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'walnut', name: 'Walnut', light: '#E2C597', dark: '#8E5D36', frame: '#4A2E1B', frameDark: '#2E1C10', coord: '#E9D3AE',
    surface: 'wood', frameSurface: 'wood', roughness: 0.48, clearcoat: 0.55,
    lastMove: 'rgba(233,196,92,0.42)', selected: 'rgba(240,206,110,0.55)', check: 'rgba(220,60,45,0.62)', hint: 'rgba(88,170,120,0.55)',
  },
  {
    id: 'tournament', name: 'Tournament', light: '#E8E3D2', dark: '#6A8763', frame: '#2B3427', frameDark: '#1A2018', coord: '#DCE3D2',
    surface: 'lacquer', frameSurface: 'wood', roughness: 0.6, clearcoat: 0.2,
    lastMove: 'rgba(222,214,96,0.48)', selected: 'rgba(232,224,120,0.6)', check: 'rgba(220,60,45,0.62)', hint: 'rgba(60,140,210,0.5)',
  },
  {
    id: 'midnight', name: 'Midnight', light: '#C7D2DB', dark: '#4A6377', frame: '#17212B', frameDark: '#0C1218', coord: '#9FB3C3',
    surface: 'stone', frameSurface: 'wood', roughness: 0.4, clearcoat: 0.6,
    lastMove: 'rgba(60,203,156,0.42)', selected: 'rgba(60,203,156,0.55)', check: 'rgba(242,90,80,0.62)', hint: 'rgba(108,168,240,0.55)',
  },
  {
    id: 'marble', name: 'Carrara Marble', light: '#EEEBE6', dark: '#8F949B', frame: '#3C3F45', frameDark: '#24262A', coord: '#E2E2E0',
    surface: 'marble', frameSurface: 'stone', roughness: 0.22, clearcoat: 0.9,
    lastMove: 'rgba(214,180,96,0.45)', selected: 'rgba(214,180,96,0.6)', check: 'rgba(210,55,45,0.6)', hint: 'rgba(70,150,120,0.55)',
  },
  {
    id: 'obsidian', name: 'Obsidian Stone', light: '#6B7079', dark: '#272A31', frame: '#121316', frameDark: '#08090A', coord: '#9CA1AA',
    surface: 'stone', frameSurface: 'stone', roughness: 0.35, clearcoat: 0.7,
    lastMove: 'rgba(120,170,230,0.38)', selected: 'rgba(150,190,240,0.5)', check: 'rgba(230,70,55,0.62)', hint: 'rgba(110,200,150,0.5)',
  },
  {
    id: 'brass', name: 'Ebony & Brass', light: '#C9A869', dark: '#2A2320', frame: '#17120F', frameDark: '#0B0806', coord: '#D9BE86',
    surface: 'lacquer', frameSurface: 'wood', roughness: 0.3, clearcoat: 0.85,
    lastMove: 'rgba(240,210,130,0.38)', selected: 'rgba(245,215,140,0.52)', check: 'rgba(225,65,50,0.62)', hint: 'rgba(100,190,150,0.5)',
  },
];

export function getBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
