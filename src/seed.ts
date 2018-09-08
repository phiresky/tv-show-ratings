import * as WebTorrent from "webtorrent-hybrid";

const t = new WebTorrent();

t.seed(
	"rust/data",
	{
		name: "data",
		announceList: [["ws://138.68.90.92:8001"]]
		//pieceLength: 2 ** 15
	},
	torrent => {
		console.log(torrent.magnetURI);
	}
);
