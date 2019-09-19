import { TorrentDataProvider, series_key } from "./load";
import { imdbproto } from "../lib/ratings";
import "@babel/polyfill";
import { render } from "react-dom";
import * as React from "react";
import Gui from "./Gui";

const qd: { [key: string]: string | undefined } = {
	noCutoff: undefined,
	d: undefined, // display chart type, undefined=line, bar=column, scatter
	align: undefined // alignment: undefined=normalize within season, season=align at season start
};
location.search
	.substr(1)
	.split("&")
	.forEach(item => {
		const [k, v] = item.split("=");
		if (k) qd[k] = v ? decodeURIComponent(v) : "";
	});
function updateQueryString() {
	const enc = encodeURI; // not encodeURICompontent for +
	history.replaceState(
		{},
		"",
		"?" +
			Object.keys(qd)
				.filter(k => qd[k] !== undefined)
				.map(k => (qd[k].length == 0 ? enc(k) : enc(k) + "=" + enc("" + qd[k])))
				.join("&")
	);
}
function linearRegression(ps: { x: number; y: number }[]) {
	let sum_x = 0,
		sum_y = 0,
		sum_xy = 0,
		sum_xx = 0,
		sum_yy = 0;

	for (const p of ps) {
		sum_x += p.x;
		sum_y += p.y;
		sum_xy += p.x * p.y;
		sum_xx += p.x * p.x;
		sum_yy += p.y * p.y;
	}
	const n = ps.length;

	const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
	const intercept = (sum_y - slope * sum_x) / n;
	//lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);
	const x0 = ps[0].x,
		x1 = ps[ps.length - 1].x;
	return [{ x: x0, y: slope * x0 + intercept }, { x: x1, y: slope * x1 + intercept }];
}
type IEpisode = imdbproto.DB.Series.IEpisode;
type ISeries = imdbproto.DB.ISeries;

const colors = [
	"#7cb5ec",
	"#434348",
	"#90ed7d",
	"#f7a35c",
	"#8085e9",
	"#f15c80",
	"#e4d354",
	"#2b908f",
	"#f45b5b",
	"#91e8e1"
];

function episodeString(ep: IEpisode) {
	const s = ep.season!,
		e = ep.episode!;
	return `S${s < 10 ? "0" + s : s} E${e < 10 ? "0" + e : e}`;
}
type Bounds = { min: number; max: number };
function seriesToSeasons(series: ISeries) {
	const seasons: Bounds[] = [];
	for (const ep of series.episodes!) {
		if (!ep.season || !ep.episode) {
			ep.season = 0;
			ep.episode = 0;
		}
		const season = seasons[ep.season] || (seasons[ep.season] = { min: Infinity, max: -Infinity });
		if (ep.episode < season.min) season.min = ep.episode;
		if (ep.episode + 1 > season.max) season.max = ep.episode + 1;
	}
	return seasons;
}

function alignEpisodeX(
	{ episode = 0, season = 0 }: IEpisode,
	seasonXOffset: number[],
	seasonsInfo: Bounds[],
	seasonMaxInfo: Bounds[]
) {
	const s = seasonsInfo[season];
	const maxs = seasonMaxInfo[season];
	const t = qd["align"];
	if (t === undefined) {
		return seasonXOffset[season] + ((episode - s.min) / (s.max - s.min)) * (maxs.max - maxs.min) + maxs.min;
	} else if (t === "season") {
		return seasonXOffset[season] + episode;
	} else if (t === "episode") {
		return seasonsInfo.slice(season).reduce((sum, x) => sum + x.max - x.min, 0) + episode;
	} else if (t === "global") {
	}
}

export function chartOptions(series: ISeries[]) {
	if (series.length === 0) return;
	const title = series.map(s => s.title).join(", ");
	const seasons = series.map(s => seriesToSeasons(s));
	// max bounds for each season
	const maxSeasons: Bounds[] = [];
	for (let i = 0; i < Math.max(...seasons.map(s => s.length)); i++) {
		const data = seasons.map(s => s[i]).filter(s => s !== undefined);
		if (data.length === 0) maxSeasons[i] = { min: 0, max: 0 };
		else
			maxSeasons[i] = {
				min: Math.min(...data.map(i => i.min)),
				max: Math.max(...data.map(i => i.max))
			};
	}
	const seasonXOffset: number[] = [0];
	for (let i = 1; i < maxSeasons.length; i++) {
		seasonXOffset[i] = seasonXOffset[i - 1] + (maxSeasons[i - 1].max - maxSeasons[i - 1].min);
	}
	const plotBands = maxSeasons.map((season, i) => ({
		from: seasonXOffset[i] + season.min,
		to: seasonXOffset[i] + season.max,
		label: { text: `Season ${i}` },
		color: "rgba(0,0,0,0)"
	}));
	const plotLines = [] as any[];
	for (let i = 0; i < maxSeasons.length; i++) {
		const season = maxSeasons[i];
		if (season.min === season.max) continue;
		plotLines.push({
			value: seasonXOffset[i] + season.min - 0.5,
			width: 1,
			color: "black"
			//label:{text:`Season ${i}`}
		});
	}

	const chartSeries = series.map((s, si) => ({
		name: s.title,
		turboThreshold: 1e6,

		type: ({ undefined: "scatter", bar: "column", scatter: "scatter", line: "line" } as any)["" + qd["d"]],
		marker: {
			enabled: true,
			radius: 5
		},
		color: colors[si],

		data: s.episodes!.map(episode => {
			return {
				name: episodeString(episode),
				x: alignEpisodeX(episode, seasonXOffset, seasons[si], maxSeasons),
				y: episode.rating! / 10,
				episode
			};
		})
	}));
	if (qd["seriesTrend"] !== undefined)
		for (let i = 0; i < series.length; i++) {
			chartSeries.push({
				name: chartSeries[i].name + " – Trendline",
				marker: { enabled: false },
				dashStyle: "shortdot",
				data: linearRegression(chartSeries[i].data),
				color: chartSeries[i].color
			} as any);
		}
	if (qd["noSeasonTrend"] === undefined) {
		for (let s = 0; s < series.length; s++) {
			const regData: { x: number; y: number }[] = [];
			const data = chartSeries[s].data;
			let season = data[0].episode.season,
				begin = 0;
			for (let i = 0; i < data.length; i++) {
				const curSeason = data[i].episode.season;
				if (curSeason != season) {
					regData.push(...linearRegression(data.slice(begin, i)));
					// add gaps
					regData.push({ x: regData[regData.length - 1].x + 0.1, y: null });
					season = curSeason;
					begin = i;
				}
			}
			regData.push(...linearRegression(data.slice(begin)));
			chartSeries.push({
				name: chartSeries[s].name + " – Trendline",
				marker: { enabled: false },
				dashStyle: "shortdot",
				data: regData,
				color: chartSeries[s].color
			} as any);
		}
	}
	const xAxis = {
		//categories: series.episodes.map(tooltip),
		plotBands,
		plotLines,
		labels: { enabled: false },
		tickLength: 0,
		minorTickLength: 0
	};
	const options = {
		title: { text: title },
		chart: {
			zoomType: "x"
		},
		xAxis,
		yAxis: {
			max: 10,
			min: qd["noCutoff"] !== undefined ? 0 : undefined,
			title: { text: "Rating" },
			tickInterval: 1
		},
		tooltip: {
			formatter: function() {
				if (!this.point.episode) return undefined;
				return `${this.series.name} <em>${episodeString(this.point.episode)}</em> : ${this.point.y.toFixed(1)}`;
			}
		},
		series: chartSeries,
		credits: { enabled: false }
	};
	qd["t"] = series.map(s => series_key(s).replace(/ /g, "_")).join("+");
	updateQueryString();
	return options;
}
async function loadUi() {
	const res = new TorrentDataProvider(console.log.bind(console));
	const initialSeries = qd.t ? qd.t.replace(/_/g, " ").split("+") : ["Game of Thrones (2011-2019)"];
	render(<Gui data={res} initialSeries={initialSeries} />, document.getElementById("app"));
}
loadUi();
