const BADGE_ASSET_PATH = '/badges';
const BADGE_EXTENSION = '.png';

export function getBadgeUrl(assetName: string): string {
  return `${BADGE_ASSET_PATH}/${assetName}${BADGE_EXTENSION}`;
}
