export const MOODS = [
  { label: 'nostalgic', color: '#FFC23D' }, { label: 'chillin', color: '#38E1FF' }, { label: 'hyped', color: '#FF4FA3' },
  { label: 'sleepy', color: '#9B7BFF' }, { label: 'in my feels', color: '#FFB3D9' }, { label: 'up to no good', color: '#5CFF8A' },
  { label: 'creative', color: '#7CF5D0' }, { label: 'hungry', color: '#FF8A5C' }, { label: 'busy', color: '#C9C6EE' },
  { label: 'grateful', color: '#A6FFC4' }, { label: 'bored', color: '#A6A3C9' }, { label: 'dramatic', color: '#FF5A9E' },
];
export const moodColor = (m?: string | null) => MOODS.find((x) => x.label === m)?.color || '#FF4FA3';
