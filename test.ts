import { findSongId, getPlaylistContent } from ".";

findSongId({
  name: "Are you in love (Feat. 정진형)",
  artist: "GLAM GOULD",
  channelIds: {},
}).then(console.log);

getPlaylistContent("http://flomuz.io/s/r.hGb2vPEzT").then(console.log);
