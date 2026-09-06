// Bhoomi AI — Google Stitch Professional Theme (Material 3 Expressive, Gov Edition)
// Single source of truth for colour, type, shape, elevation.
// Inspired by Google Stitch: light, airy, authoritative blue, generous radius.

export const stitchTokens = {
  // Brand
  brand: 'Bhoomi AI',
  subBrand: 'Land Record OS',

  // Primary — Google Blue (trust, gov authority)
  primary: '#0B57D0',
  primaryDark: '#0842A0',
  primaryDarker: '#062E6F',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#041E49',

  // Secondary — Slate Navy (executive text / sidebar ink)
  ink: '#0F1F38',
  inkSoft: '#334155',
  inkMuted: '#64748B',
  surface: '#FFFFFF',

  // Page + containers (M3 surface-container scale)
  pageBg: '#F1F4F9',
  containerLow: '#F8FAFC',
  container: '#EDF0F5',
  containerHigh: '#E5EAF1',

  // Borders / outlines
  border: '#E1E6EE',
  borderStrong: '#C9D2E0',
  borderMuted: '#EEF1F6',

  // Accents — used sparingly (India gov identity, no neon)
  saffron: '#C76A0A',       // muted India saffron for LIVE / highlights
  saffronSoft: '#FEF3E6',
  saffronBorder: '#F5D9B8',
  success: '#137333',       // Google green
  successSoft: '#E6F4EA',
  warning: '#B06000',
  warningSoft: '#FEF7E0',
  error: '#B3261E',
  errorSoft: '#FCE8E6',

  // Deep navy — hero / footer only
  navy900: '#0A1F44',
  navy800: '#10294F',
  navy700: '#1A3A68',

  // Typography
  fontDisplay: "'Plus Jakarta Sans','Inter',system-ui,sans-serif",
  fontBody: "'Inter','Noto Sans Devanagari',system-ui,sans-serif",
  fontMono: "'JetBrains Mono',ui-monospace,monospace",

  // Shape (M3 Expressive)
  radiusSm: 10,
  radiusMd: 16,
  radiusLg: 20,
  radiusXl: 28,

  // Elevation (soft M3, no harsh black)
  shadowSm: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)',
  shadowMd: '0 4px 12px rgba(16,24,40,0.08), 0 2px 6px rgba(16,24,40,0.06)',
  shadowLg: '0 12px 32px rgba(11,87,208,0.10), 0 4px 12px rgba(16,24,40,0.08)',
};

export const govBlueTheme = {
  token: {
    colorPrimary: stitchTokens.primary,
    colorInfo: stitchTokens.primary,
    colorSuccess: stitchTokens.success,
    colorWarning: stitchTokens.warning,
    colorError: stitchTokens.error,
    colorBgBase: stitchTokens.pageBg,
    colorBgContainer: stitchTokens.surface,
    colorBgElevated: stitchTokens.surface,
    colorText: '#16213A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorBorder: stitchTokens.border,
    colorBorderSecondary: stitchTokens.borderMuted,
    fontFamily: stitchTokens.fontBody,
    borderRadius: 12,
    controlHeight: 38,
  },
  components: {
    Layout: { siderBg: '#FFFFFF', headerBg: '#FFFFFF', bodyBg: stitchTokens.pageBg },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#475569',
      itemHoverBg: '#EEF2FA',
      itemHoverColor: stitchTokens.ink,
      itemSelectedBg: stitchTokens.primary,
      itemSelectedColor: '#FFFFFF',
      itemBorderRadius: 10,
      itemHeight: 40,
    },
    Card: { borderRadiusLG: 20, paddingLG: 20 },
    Button: { borderRadius: 12, controlHeight: 40, fontWeight: 700 },
    Input: { borderRadius: 12, controlHeight: 40 },
    Select: { borderRadius: 12, controlHeight: 40 },
    Table: { headerBg: '#F8FAFC', headerColor: '#334155', rowHoverBg: '#F3F6FC' },
    Tag: { borderRadiusSM: 999 },
  },
};

export default stitchTokens;
