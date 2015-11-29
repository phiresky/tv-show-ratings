function getArrayBuffer(filename: string, callback: (data: ArrayBuffer) => void) {
	const oReq = new XMLHttpRequest();
	oReq.open("GET", filename, true);
	oReq.responseType = "arraybuffer";

	oReq.onload = ev =>
		callback(oReq.response as ArrayBuffer);

	oReq.send();
}
const qd: { [key: string]: (string) } = {
	noCutoff: undefined,
	d: undefined, // display chart type, undefined=line, bar=column, scatter
	align: undefined // alignment: undefined=normalize within season, season=align at season start
};
location.search.substr(1).split("&").forEach(item => {
    const [k, v] = item.split("=");
    if(k) qd[k] = v ? decodeURIComponent(v) : "";
});
function updateQueryString() {
	const enc = encodeURI; // not encodeURICompontent for +
	history.replaceState({}, "", "?"+Object.keys(qd)
	.filter(k => qd[k] !== undefined)
	.map(k => qd[k].length == 0 ? enc(k) : enc(k) +"="+enc(""+qd[k]))
	.join("&"));
};
function linearRegression(ps:{x:number, y:number}[]){
	let sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0, sum_yy = 0;
	
	for (const p of ps) {
		sum_x += p.x; sum_y += p.y;
		sum_xy += p.x*p.y;
		sum_xx += p.x*p.x; sum_yy += p.y*p.y;
	}
	const n = ps.length;
	
	const slope = (n * sum_xy - sum_x * sum_y) / (n*sum_xx - sum_x * sum_x);
	const intercept = (sum_y - slope * sum_x)/n;
	//lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);
	const x0 = ps[0].x, x1 = ps[ps.length - 1].x;
	return [{x:x0, y:slope*x0 + intercept}, {x:x1, y:slope*x1 + intercept}];
}
declare var dcodeIO:any, $:any, AutoComplete:any;
(<any>window).ProtoBuf = dcodeIO.ProtoBuf;
type Episode = imdbproto.DB.Series.Episode;
type Series = imdbproto.DB.Series;
type IndexedSeries = [number, Series];

let renderSuccess = false;
let database: imdbproto.DB;
let currentDisplay: IndexedSeries[] = [];
let autoComplete: any;
let chart: any;
function getSeries(title: string, year: number):[number, Series] {
	let i = 0;
	for(const series of database.series) {
		if(series.title === title && series.year === year) return [i,series];
		i++;
	}
}
function episodeString(ep:Episode) {
	const s = ep.season, e = ep.episode;
	return `S${s<10?'0'+s:s} E${e<10?'0'+e:e}`
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
		autoComplete.setValue(series.map(([i,s]) => [seriesToAutocomplete(s,i)]));
		//showChart(series);
	}
}
type Bounds = {min:number, max:number};
function seriesToSeasons(series:Series) {
	const seasons:Bounds[] = [];
	for(const ep of series.episodes) {
		if(ep.season === null || ep.episode === null) {
			throw "NO"+JSON.stringify(series);
		}
		const season = seasons[ep.season] || (seasons[ep.season] = {min:Infinity, max:-Infinity});
		if(ep.episode < season.min) season.min = ep.episode;
		if(ep.episode + 1 > season.max) season.max = ep.episode + 1;
	}
	return seasons;
}

function alignEpisodeX({episode, season}:Episode, seasonXOffset: number[], seasonsInfo:Bounds[], seasonMaxInfo:Bounds[]) {
	const s = seasonsInfo[season];
	const maxs = seasonMaxInfo[season];
	const t = qd["align"];
	if(t === undefined) {
		return seasonXOffset[season] + (episode-s.min) / (s.max-s.min) * (maxs.max - maxs.min) + maxs.min
	} else if(t === "season") {
		return seasonXOffset[season] + episode;
	} else if(t === "episode") {
		return seasonsInfo.slice(season).reduce((sum, x) => sum + x.max - x.min, 0) + episode;
	} else if(t === "global") {
		
	}
}

function showChart(series: IndexedSeries[]) {
	currentDisplay = series;
	if(series.length === 0) return;
	const title = series.map(s => s[1].title).join(", ");
	const seasons = series.map(s => seriesToSeasons(s[1]));
	// max bounds for each season
	const maxSeasons:Bounds[] = [];
	for(let i = 0; i < Math.max(...seasons.map(s => s.length)); i++) {
		const data = seasons.map(s => s[i]).filter(s => s !== undefined);
		if(data.length === 0) maxSeasons[i] = {min:0, max:0};
		else maxSeasons[i] = {min:Math.min(...data.map(i => i.min)), max:Math.max(...data.map(i => i.max))};
	}
	const seasonXOffset:number[] = [0];
	for(let i = 1; i < maxSeasons.length; i++) {
		seasonXOffset[i] = seasonXOffset[i-1] + (maxSeasons[i-1].max - maxSeasons[i-1].min);
	}
	const plotBands = maxSeasons.map((season,i) =>({
		from: seasonXOffset[i]+season.min, to: seasonXOffset[i] + season.max,
		label:{text:`Season ${i}`}
	}));
	
	const plotLines = maxSeasons.filter(s => s.min !== s.max).map((season,i) =>({
		value: seasonXOffset[i] + season.min - 0.5, width:1, color:"black",
		//label:{text:`Season ${i}`}
	}));
	
	const chartSeries = series.map(([i,s], si) => ({
		name: s.title,
		type: ({"undefined":"line", "bar":"column", "scatter":"scatter"} as any)[""+qd["d"]],
		marker: {
			enabled: true, radius: 5
		},
		data: s.episodes.map((episode) => {
			return {
				name:episodeString(episode),
				x: alignEpisodeX(episode, seasonXOffset, seasons[si], maxSeasons),
				y: episode.rating/10,
				episode
			}
		})
	}));
	if(qd["seriesTrend"] !== undefined)	for(let i = 0; i < series.length; i++) {
		chartSeries.push({
			name: chartSeries[i].name+" – Trendline",
			marker: {enabled:false},
			data: linearRegression(chartSeries[i].data)
		} as any);
	}
	if(qd["seasonTrend"] !== undefined) {
		for(let s = 0; s < series.length; s++) {
			const regData:{x:number,y:number}[] = [];
			const data = chartSeries[s].data;
			let season = data[0].episode.season, begin = 0;
			for(let i = 0; i < data.length; i++) {
				const curSeason = data[i].episode.season;
				if(curSeason != season) {
					regData.push(...linearRegression(data.slice(begin, i)));
					// add gaps
					regData.push({x:regData[regData.length-1].x+0.1, y:null});
					season = curSeason;
					begin = i;
				}
			}
			regData.push(...linearRegression(data.slice(begin)));
			chartSeries.push({
				name: chartSeries[s].name+" – Trendline",
				marker: {enabled:false},
				data: regData
			} as any);
		}
	}
	const xAxis = {
		//categories: series.episodes.map(tooltip),
		plotBands,
		plotLines,
		labels: {enabled:false},
		tickLength: 0,
		minorTickLength: 0
	};
	if(!chart) {
		chart = $("#chartContainer").highcharts({
			title: { text: title },
			chart: {
				zoomType: 'x'
			},
			xAxis,
			yAxis: {
				max: 10,
				min: qd["noCutoff"] !== undefined ? 0:undefined,
				title: {text: "Rating"},
				tickInterval: 1,
			},
			tooltip: {
				formatter: function() {
					if(!this.point.episode) return undefined;
					return `${this.series.name} <em>${episodeString(this.point.episode)}</em> : ${this.point.y.toFixed(1)}`
				}
			},
			series: chartSeries,
			credits: { enabled:false }
		}).highcharts();
	} else {
		chart.setTitle({text:title});
		while(chart.series.length > 0) chart.series[0].remove(false);
		chart.xAxis[0].remove(false);
		chart.addAxis(xAxis, true, false);
		chart.colorCounter = 0;
		chart.symbolCounter = 0;
		chartSeries.forEach(c => chart.addSeries(c, false));
		chart.redraw();
	}
	qd["t"] = series.map(([i,s]) => `${s.title} ${s.year}`.replace(/ /g, "_")).join("+");
	updateQueryString();
}
function seriesToAutocomplete(series: Series, inx: number) {
	const txt = `${series.title} (${series.year})`;
	return {optionHTML:txt, tokenHTML:txt, value:inx};
}
declare var _schema: any; // added by makefile
{
	const builder:imdbproto.ProtoBufBuilder = ProtoBuf.loadJson(_schema).build("imdbproto") as any;
	getArrayBuffer("basedata-popular.buf.js", baseData => {
		database = builder.DB.decode(baseData);
		autoComplete = new AutoComplete("search", {
			placeholderHTML: "Search for TV series...",
			
			lists: {series: {
				options:database.series.map(seriesToAutocomplete),
				//optionHTML: (s:Series) => s.title,
				//tokenHTML: x => "a"
				matchOptions: (inp:string, res:any[]) => res.slice(0, 20).filter(v => !currentDisplay.some(([i,s])=>i===v.value)),
			}},
			onChange: (val:any[]) => showChart(val.map(v => [v[0].value,database.series[v[0].value]] as IndexedSeries))
		});
		if(qd["t"]) tryShowInitialChart();
		getArrayBuffer("basedata-unpopular.buf.js", baseData2 => {
			const db2 = builder.DB.decode(baseData2);
			for(const series of db2.series) {
				const inx = database.series.push(series) - 1;
				autoComplete.addOption("series", seriesToAutocomplete(series, inx));
			}
			if(qd["t"] && !renderSuccess) tryShowInitialChart();
		});
	});
	
}