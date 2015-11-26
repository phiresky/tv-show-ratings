function getArrayBuffer(filename: string, callback: (data: ArrayBuffer) => void) {
	const oReq = new XMLHttpRequest();
	oReq.open("GET", filename, true);
	oReq.responseType = "arraybuffer";

	oReq.onload = ev =>
		callback(oReq.response as ArrayBuffer);

	oReq.send();
}
const qd: { [key: string]: string } = {};
location.search.substr(1).split("&").forEach(item => {
    const [k, v] = item.split("=");
    if(k) qd[k] = v && decodeURIComponent(v);
});
function updateQueryString() {
	history.replaceState({}, "", "?"+$.param(qd));
}
declare var dcodeIO:any, $:any, AutoComplete:any;
(<any>window).ProtoBuf = dcodeIO.ProtoBuf;
let renderSuccess = false;
let database : imdbproto.DB;
function getSeries(title: string, year: number) {
	for(const series of database.series) {
		if(series.title === title && series.year === year) return series;
	}
}
function episodeString(ep:imdbproto.DB.Series.Episode) {
	const s = ep.season, e = ep.episode;
	return `S${s<10?'0'+s:s} E${e<10?'0'+e:e}`
}
function tooltip(ep:imdbproto.DB.Series.Episode) {
	return `<em>${episodeString(ep)}</em>`;
}
function tryShowInitialChart() {
	console.log("showing initial chart");
	const series = qd["t"].replace(/_/g, " ").split("+").map(info => {
		const inx = info.lastIndexOf(" ");
		const title = info.substr(0, inx);
		const year = +info.substr(inx + 1);
		return getSeries(title, year);
	});
	if(series.every(s => s !== undefined)) {
		renderSuccess = true;
		showChart(series);
	}
}
function showChart(series: imdbproto.DB.Series[]) {
	if(series.length === 0) return;
	const title = series.map(s => s.title).join(", ");
	let allEps:imdbproto.DB.Series.Episode[] = [].concat.apply([], series.map(s => s.episodes));
	allEps.sort((a,b) => a.season - b.season || a.episode - b.episode);
	allEps = allEps.filter((ep, i) => i == 0 || ep.season != allEps[i-1].season || ep.episode != allEps[i-1].episode);
	const seasons:{from:number, to: number}[] = [{from:0, to:0}];
	allEps.reduce((a, b, inx) => {
		if(a !== b.season) {
			seasons[a].to = inx;
			if(!seasons[b.season]) seasons[b.season] = {from:0,to:0};
			seasons[b.season].from = inx;
		}
		return b.season;
	}, 0);
	seasons[seasons.length - 1].to = allEps.length;
	const plotBands = seasons.map((season,i) =>({
		from: season.from, to: season.to,
		label:{text:`Season ${i}`}
	}));
	
	const plotLines:any[] = [];
	for(const season of seasons) {
		if(!season) continue;
		plotLines.push({value: season.from + 0.5, width:1, color:"black"})
		plotLines.push({value: season.to + 0.5, width:1, color:"black"})
	}
	$("#chartContainer").highcharts({
		title: { text: title },
		xAxis: {
			//categories: series.episodes.map(tooltip),
			plotBands,
			plotLines,
			type: 'category'
		},
		yAxis: {
			title: {text: "Rating"},
				
		},
		tooltip: {
			formatter: function() {return `${this.series.name} <em>${episodeString(this.point.episode)}</em>`}
		},
		series: series.map(s => ({
			name: s.title,
			//lineWidth: 0,
			marker: {
				enabled: true, radius: 5
			},
			data: s.episodes.map((episode,i) => ({name:episodeString(episode), x:episode.episode + seasons[episode.season].from, y:episode.rating/10, episode}))
		}))
	});
	qd["t"] = series.map(s => `${s.title} ${s.year}`.replace(/ /g, "_")).join(" ");
	updateQueryString();
}
function seriesToAutocomplete(series: imdbproto.DB.Series, inx: number) {
	return {optionHTML:`${series.title} (${series.year})`, value:inx};
}
declare var _schema: any; // added by makefile
{
	const builder:imdbproto.ProtoBufBuilder = ProtoBuf.loadJson(_schema).build("imdbproto") as any;
	getArrayBuffer("basedata-popular.buf.js", baseData => {
		database = builder.DB.decode(baseData);
		const comp = new AutoComplete("search", {
			placeholderHTML: "Search for TV series...",
			lists: {series: {
				options:database.series.map(seriesToAutocomplete),
				//optionHTML: (s:imdbproto.DB.Series) => s.title,
				//tokenHTML: x => "a"
			}},
			onChange: (val:any[]) => showChart(val.map(v => database.series[v[0].value]))
		});
		if(qd["t"]) tryShowInitialChart();
		getArrayBuffer("basedata-unpopular.buf.js", baseData2 => {
			const db2 = builder.DB.decode(baseData2);
			for(const series of db2.series) {
				const inx = database.series.push(series) - 1;
				comp.addOption("series", seriesToAutocomplete(series, inx));
			}
			if(qd["t"] && !renderSuccess) tryShowInitialChart();
		});
	});
	
}