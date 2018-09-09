import WebTorrent, { TorrentFile } from "webtorrent";
import { imdbproto } from "../lib/ratings";
import { promisify } from "es6-promisify";
import { sha256 } from "js-sha256";
import idb from "indexeddb-chunk-store";
import uri from "../parse-data-rs/data.torrent";

// must be same as rust
export function series_key(s: imdbproto.DB.ISeries) {
	return `${s.title} (${s.startYear || " "}-${s.endYear || " "})`;
}

const dontDownloadUnneeded = false;
export class TorrentDataProvider {
	client = new WebTorrent();
	torrent: WebTorrent.Torrent;
	tFileMap: Promise<Map<string, TorrentFile>>;
	cFileMap: Map<string, imdbproto.DB> = new Map();
	constructor(private progress: (message: string) => void) {
		this.torrent = this.client.add(new URL(uri, location.href).href, { store: idb });
		this.torrent.on("infoHash", () => console.log("infoHash", this.torrent.infoHash));
		this.progress("loading index");
		this.torrent.on("noPeers", function(announceType) {
			console.log("got no peers from", announceType);
		});
		this.torrent.on("done", () => {
			console.log("got all data");
		});
		// this.torrent.on("metadata", storeTorrent);
		this.torrent.on("warning", e => {
			if (e && e instanceof Error && e.message.startsWith("Unsupported tracker protocol")) return;
			console.log(e);
		});
		/*let total = 0;
		this.torrent.on("download", bytes => {
			total += bytes;
			console.log("got ", bytes, "total", total, "got", this.torrent.downloaded);
		});*/
		this.tFileMap = this._indexReady();
	}
	private async _indexReady() {
		await new Promise(ready => this.torrent.on("ready", ready));
		this.progress("index loaded");
		/*this.torrent.addWebSeed(
			""
		);*/
		console.log(this.torrent);
		if (dontDownloadUnneeded) {
			this.torrent.deselect(0, this.torrent.pieces.length - 1, 0);
		}
		const fmap = new Map(this.torrent.files.map(f => [f.name, f] as [string, TorrentFile]));
		fmap.get("titles.json")!.select(0.5);
		return fmap;
	}
	async getNames() {
		const files = await this.tFileMap;
		const inx = files.get("titles.json")!;
		this.progress("loading names");
		const blobUrl = await promisify(inx.getBlobURL.bind(inx) as typeof inx.getBlobURL)();
		this.progress("loading names 2");
		const res = await fetch(blobUrl).then(p => p.json());
		return res as string[];
	}

	async getSeriesInfo(seriesName: string) {
		const fname = `${sha256(seriesName).substr(0, 2)}.buf`;
		this.progress(`loading ${fname} for ${seriesName}`);
		if (!this.cFileMap.get(fname)) {
			const files = await this.tFileMap;
			const f = files.get(fname);
			if (!f) throw Error(`Could not find file ${fname}`);
			const getBuffer = promisify(f.getBuffer.bind(f) as typeof f.getBuffer);
			const buffer = await getBuffer();
			const parsed = imdbproto.DB.decode(buffer);
			this.cFileMap.set(fname, parsed);
		}
		const db = this.cFileMap.get(fname)!;
		return db.series.find(series => series_key(series) === seriesName);
	}
}
