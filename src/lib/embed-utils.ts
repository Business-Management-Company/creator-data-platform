// Extract embed IDs from YouTube and Spotify URLs
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function getSpotifyEmbedUrl(url: string): string | null {
  if (!url || !url.includes('spotify.com')) return null;
  // Convert spotify URL to embed format
  const trackMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const albumMatch = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);
  const playlistMatch = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  const episodeMatch = url.match(/spotify\.com\/episode\/([a-zA-Z0-9]+)/);
  if (trackMatch) return `https://open.spotify.com/embed/track/${trackMatch[1]}`;
  if (albumMatch) return `https://open.spotify.com/embed/album/${albumMatch[1]}`;
  if (playlistMatch) return `https://open.spotify.com/embed/playlist/${playlistMatch[1]}`;
  if (episodeMatch) return `https://open.spotify.com/embed/episode/${episodeMatch[1]}`;
  return null;
}
