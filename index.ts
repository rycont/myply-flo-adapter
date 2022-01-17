import axios, { AxiosError } from "axios";
import { Adaptor, Playlist, Song } from "myply-common";

let floToken: string | undefined;

const endpoints = {
  search: (query: string) =>
    `https://www.music-flo.com/api/search/v2/search?keyword=${encodeURIComponent(
      query
    )}&searchType=TRACK&sortType=ACCURACY&size=50&page=1&timestamp=${+new Date()}`,
  login: () => "https://api.music-flo.com/auth/v3/sign/in",
  createPlaylist: () => "https://api.music-flo.com/personal/v2/myplaylist",
};

const keyTable = ["d", "a", "n", "i", "e", "l", "z", "o", "h", "y"];

function encrypt(e: number) {
  return [...e.toString()].map((i) => keyTable[+i]).join("");
}

function decrypt(e: string) {
  return +[...e].map((i) => keyTable.indexOf(i)).join("");
}

const REGEX_FIND_BRAKET = /\(.*\)/;

export const findSongId = async (song: Song): Promise<string | null> => {
  const res = await axios.get(endpoints.search(`${song.artist} ${song.name}`));
  try {
    return res.data.data.list
      .find((e: { type: string }) => e.type === "TRACK")
      .list[0].id.toString();
  } catch (e) {
    if (song.name.match(REGEX_FIND_BRAKET)) {
      return await findSongId({
        ...song,
        name: song.name.replace(REGEX_FIND_BRAKET, "").trim(),
      });
    }
    if (song.artist) {
      return await findSongId({
        ...song,
        artist: "",
      });
    }
    console.log(
      `Missed Match on Spotify`,
      song.artist + " " + song.name,
      (e as Error).message
    );
    return null;
  }
};

export const getPlaylistContent = async (uri: string): Promise<Playlist> => {
  const d = await axios(uri, {
    maxRedirects: 2,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
      "sec-ch-ua-platform": "Windows",
    },
  });

  const playlistId = decrypt(d.request.path.split("/")[3]);
  const rawPlaylist = (
    await axios(
      `https://api.music-flo.com/personal/v1/playlist/${playlistId}?depth=2&mixYn=N`
    )
  ).data.data;

  const tracks: Song[] = rawPlaylist.track.list.map((e: any) => ({
    name: e.name,
    artist: e.representationArtist.name,
    channelIds: {
      flo: e.id,
    },
  }));

  const name = rawPlaylist.name;
  const description = rawPlaylist.chnlDesc;

  return {
    name,
    description,
    preGenerated: {
      flo: uri,
    },
    tracks,
  };
};

export const getMasterToken = async (): Promise<string> => {
  if (floToken) return floToken;

  floToken = (
    await axios(endpoints.login(), {
      method: "POST",
      data: {
        memberId: process.env.FLO_USERNAME,
        memberPwd: process.env.FLO_PASSWORD,
        requestChannelType: "AAPP",
        signInType: "IDM",
      },
      headers: {
        "x-gm-device-id": btoa(
          (
            ((+new Date() / Math.random()) * Math.random()) %
            17100000001
          ).toString()
        ).slice(1, 17),
      },
    })
  ).data.data.accessToken;
  setTimeout(() => (floToken = undefined), 1000 * 60 * 60 * 24 * 7); // 일주일 TTL
  return floToken!;
};

export const generateURL = async (playlist: Playlist): Promise<string> => {
  const res = await axios(endpoints.createPlaylist(), {
    method: "POST",
    headers: {
      "x-gm-access-token": await getMasterToken(),
    },
    data: {
      chnlDesc: playlist.description,
      name: playlist.name,
      publishYn: "Y",
      trackList: playlist.tracks.map((e) => ({
        newYn: "Y",
        trackId: e.channelIds.flo,
      })),
    },
  });

  console.log(res.data);

  return `https://www.music-flo.com/detail/openplaylist/${encrypt(
    res.data.data.id
  )}`;
};

export const FloAdapter: Adaptor = {
  findSongId,
  getPlaylistContent,
  determinator: ["flo"],
  generateURL,
  display: {
    color: "#3F3FFF",
    name: "플로",
    logo: `<svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_422_230)">
    <path d="M25.941 0.71C25.719 0.71 25.136 1.097 24.507 1.391C24.096 1.583 23.405 1.863 22.608 2.099C21.625 2.39 20.751 2.57 19.132 2.57C17.791 2.57 16.185 2.333 14.221 1.835C13.3365 1.6076 12.4439 1.41313 11.545 1.252C10.607 1.085 9.73301 0.993 8.92401 0.993C7.71501 0.993 6.55501 1.126 5.44801 1.393C4.27158 1.67433 3.13911 2.11508 2.08201 2.703C1.89501 2.808 1.80701 2.979 1.80701 3.2V9.379C1.80701 9.645 1.92801 9.766 2.13801 9.766C2.27401 9.766 2.38401 9.693 2.43201 9.664C3.19001 9.192 4.27101 8.736 5.44801 8.442C6.58391 8.15137 7.75151 8.0029 8.92401 8C9.75101 8 10.607 8.082 11.545 8.248C12.483 8.414 13.37 8.624 14.221 8.827C16.434 9.355 18.063 9.599 19.132 9.599C20.258 9.599 21.393 9.415 22.608 9.048C23.259 8.85342 23.8939 8.60869 24.507 8.316C25.002 8.078 25.472 7.809 25.917 7.503C26.102 7.376 26.193 7.238 26.193 7.006V1.017C26.193 0.821 26.126 0.71 25.941 0.71V0.71ZM55.931 32.22H44.897C44.014 32.22 43.315 31.963 42.8 31.448C42.284 30.934 42.028 30.234 42.028 29.351V1.103C42.028 0.809 41.88 0.661 41.586 0.661H35.296C35.001 0.661 34.854 0.809 34.854 1.103V30.731C34.854 33.306 35.635 35.375 37.199 36.938C38.762 38.502 40.83 39.282 43.405 39.282H55.929C56.223 39.282 56.371 39.136 56.371 38.842V32.662C56.373 32.368 56.225 32.22 55.931 32.22V32.22ZM95.572 9.959C93.825 6.888 91.453 4.46 88.455 2.676C85.457 0.892 82.194 0 78.662 0C75.131 0 71.857 0.892 68.841 2.675C65.825 4.459 63.435 6.887 61.669 9.958C59.904 13.029 59.021 16.368 59.021 19.971C59.021 23.613 59.904 26.961 61.669 30.013C63.435 33.066 65.825 35.494 68.841 37.296C71.857 39.099 75.131 40 78.662 40C82.193 40 85.457 39.109 88.455 37.324C91.453 35.54 93.825 33.113 95.572 30.041C97.319 26.971 98.193 23.613 98.193 19.971C98.193 16.368 97.32 13.03 95.572 9.959V9.959ZM89.503 26.565C88.381 28.607 86.864 30.226 84.951 31.42C83.039 32.616 80.942 33.213 78.662 33.213C76.418 33.213 74.321 32.607 72.372 31.392C70.4383 30.1953 68.8428 28.524 67.737 26.537C66.597 24.514 66.027 22.326 66.027 19.971C66.027 17.654 66.597 15.475 67.737 13.433C68.877 11.392 70.422 9.774 72.372 8.578C74.321 7.384 76.417 6.785 78.662 6.785C80.942 6.785 83.039 7.384 84.951 8.578C86.864 9.774 88.38 11.383 89.503 13.406C90.624 15.43 91.186 17.618 91.186 19.971C91.186 22.326 90.625 24.524 89.503 26.565V26.565ZM25.752 14.675H10.359C7.78401 14.675 5.71501 15.458 4.15201 17.02C2.58801 18.584 1.80701 20.653 1.80701 23.227V38.84C1.80701 39.136 1.95401 39.282 2.24901 39.282H8.53901C8.83301 39.282 8.98101 39.136 8.98101 38.84V24.607C8.98101 23.724 9.23801 23.026 9.75301 22.51C10.268 21.996 10.967 21.738 11.85 21.738H25.753C26.047 21.738 26.195 21.591 26.195 21.296V15.116C26.193 14.823 26.046 14.675 25.752 14.675" fill="white"/>
    </g>
    <defs>
    <clipPath id="clip0_422_230">
    <rect width="100" height="40" fill="white"/>
    </clipPath>
    </defs>
    </svg>
    `,
  },
};
