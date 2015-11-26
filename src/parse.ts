#!/usr/bin/env node

const ProtoBuf = require("protobufjs");
const builder:imdbproto.ProtoBufBuilder = ProtoBuf.loadJsonFile("src/ratings.json").build("imdbproto") as any;
const fs = require('fs');
const minEpisodes = 3, minVotes = 30, popularVotes = 2000;
const baseConfig = {
	inFile: "data/ratings-series.list",
	outFile: "basedata-popular.buf",
	filter: (series:imdbproto.DB.Series) => 
		series.votes >= popularVotes && series.episodes.length >= minEpisodes,
	show: {
		series: {
			title: true,
			year: true,
			rating: true,
			votes: true,
			distribution: false,
		},
		episode: {
			rating: true,
			season: true,
			episode: true,
			title: false,
			votes: false,
			distribution: false,
		}
	}
}
const transformLine = (db: imdbproto.DB, config: typeof baseConfig) => 
		(target: imdbproto.DB.Series, line: string): imdbproto.DB.Series => {
	// format: '      0000001223     329   8.5  "Elementary" (2012) {A Controlled Descent (#3.24)}'
	line = line.substr(6);
	const match = line.match(/^([*.0-9]{10})\s+(\d+)\s+(\d+\.\d)\s+"([^"]+)" \((\d{4}|\?{4})(?:\/(I|II|III|IV|V|VI|VII))?\)(?: \{(.*)\})?$/);
	if(match === null)
		throw Error(`could not parse ${line}`);
	let [, distribution, votes, avg, series, year, roman_num, episodeInfo] = match;
	if(roman_num) series += ` ${roman_num}`;
	const distributionInt = +distribution.replace('.', '0').replace('*', '9');
	if(episodeInfo === undefined) {
		// is new series
		//console.log(`after ${target && target.episodes.length} episodes, new series starts: "${series}"`);
		target = new builder.DB.Series();
		target.title = series;
		target.distribution = distributionInt;
		if(year !== "????") target.year = +year;
		target.rating = +avg * 10;
		target.votes = +votes;
		db.series.push(target);
	} else {
		if(series !== target.title) {
			/*if(+votes > 50)
				console.warn(`Warning: series != ${target.title} in '${line}'`);
			// it's missing because there are less than 5 votes for IMDb*/
			return target;
		}
		const episode = new builder.DB.Series.Episode();
		const [, title, season, episodeNum] = episodeInfo.match(/^(.*?)(?: ?\(#(\d+)\.(\d+)\))?$/);
		episode.title = title;
		episode.rating = +avg * 10;
		episode.distribution = distributionInt;
		episode.votes = +votes;
		if(season !== undefined) episode.season = +season;
		if(episodeNum !== undefined) episode.episode = +episodeNum;
		target.episodes.push(episode);
	}
	return target;
}
function applyShow(show: any, obj: any) {
	for(const attr in show) if(!show[attr]) obj[attr] = null;
}
function parseDB(config: typeof baseConfig) {
	const lines: string[] = fs.readFileSync(config.inFile, "utf8").split("\n");
	lines.pop();
	const db = new builder.DB();
	lines.reduce(transformLine(db, baseConfig), null as imdbproto.DB.Series);
	db.series = db.series.filter(config.filter);
	db.series.sort((a,b) => b.votes - a.votes);
	for(const series of db.series) {
		applyShow(config.show.series, series);
		series.episodes.sort((a,b) => a.season - b.season || a.episode - b.episode);
		for(const episode of series.episodes)
			applyShow(config.show.episode, episode);
	}
	const buf =  (db as any).encode().toBuffer();
	fs.writeFileSync(config.outFile, buf);
	console.log(`wrote ${db.series.length} series (${buf.length/1000} kB) to ${config.outFile}`)
}


parseDB(baseConfig);

baseConfig.outFile = "basedata-unpopular.buf";
baseConfig.filter = series => 
		series.votes > minVotes && series.votes < popularVotes && series.episodes.length >= minEpisodes;
parseDB(baseConfig);

baseConfig.outFile = "additionalData.buf";
const s = baseConfig.show as any;
for(const key in s) s[key] = !s[key];
baseConfig.filter = series => 
		series.votes > minVotes && series.episodes.length >= minEpisodes;
parseDB(baseConfig);