import * as WebTorrent from "webtorrent-hybrid";
import * as fs from "fs";
const t = new WebTorrent();

t.seed(
	"parse-data-rs/data/",
	{
		name: "data"
		//pieceLength: 2 ** 15
	},
	torrent => {
		console.log(torrent.magnetURI);
		fs.writeFileSync("parse-data-rs/data.torrent", torrent.torrentFile);
	}
);
