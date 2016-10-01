function getArrayBuffer(filename, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", filename, true);
    oReq.responseType = "arraybuffer";
    oReq.onload = function (ev) {
        return callback(oReq.response);
    };
    oReq.send();
}
var qd = {
    noCutoff: undefined,
    d: undefined,
    align: undefined // alignment: undefined=normalize within season, season=align at season start
};
location.search.substr(1).split("&").forEach(function (item) {
    var _a = item.split("="), k = _a[0], v = _a[1];
    if (k)
        qd[k] = v ? decodeURIComponent(v) : "";
});
function updateQueryString() {
    var enc = encodeURI; // not encodeURICompontent for +
    history.replaceState({}, "", "?" + Object.keys(qd)
        .filter(function (k) { return qd[k] !== undefined; })
        .map(function (k) { return qd[k].length == 0 ? enc(k) : enc(k) + "=" + enc("" + qd[k]); })
        .join("&"));
}
;
function linearRegression(ps) {
    var sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0, sum_yy = 0;
    for (var _i = 0, ps_1 = ps; _i < ps_1.length; _i++) {
        var p = ps_1[_i];
        sum_x += p.x;
        sum_y += p.y;
        sum_xy += p.x * p.y;
        sum_xx += p.x * p.x;
        sum_yy += p.y * p.y;
    }
    var n = ps.length;
    var slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
    var intercept = (sum_y - slope * sum_x) / n;
    //lr['r2'] = Math.pow((n*sum_xy - sum_x*sum_y)/Math.sqrt((n*sum_xx-sum_x*sum_x)*(n*sum_yy-sum_y*sum_y)),2);
    var x0 = ps[0].x, x1 = ps[ps.length - 1].x;
    return [{ x: x0, y: slope * x0 + intercept }, { x: x1, y: slope * x1 + intercept }];
}
window.ProtoBuf = dcodeIO.ProtoBuf;
var colors = ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9',
    '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'];
var renderSuccess = false;
var database;
var currentDisplay = [];
var autoComplete;
var chart;
function getSeries(title, year) {
    var i = 0;
    for (var _i = 0, _a = database.series; _i < _a.length; _i++) {
        var series = _a[_i];
        if (series.title === title && series.year === year)
            return [i, series];
        i++;
    }
}
function episodeString(ep) {
    var s = ep.season, e = ep.episode;
    return "S" + (s < 10 ? '0' + s : s) + " E" + (e < 10 ? '0' + e : e);
}
function tryShowInitialChart() {
    console.log("showing initial chart");
    var series = qd["t"].replace(/_/g, " ").split("+").map(function (info) {
        var inx = info.lastIndexOf(" ");
        var title = info.substr(0, inx);
        var year = +info.substr(inx + 1);
        return getSeries(title, year);
    });
    if (series.every(function (s) { return s !== undefined; })) {
        renderSuccess = true;
        autoComplete.setValue(series.map(function (_a) {
            var i = _a[0], s = _a[1];
            return [seriesToAutocomplete(s, i)];
        }));
    }
}
function seriesToSeasons(series) {
    var seasons = [];
    for (var _i = 0, _a = series.episodes; _i < _a.length; _i++) {
        var ep = _a[_i];
        if (ep.season === null || ep.episode === null) {
            throw "NO" + JSON.stringify(series);
        }
        var season = seasons[ep.season] || (seasons[ep.season] = { min: Infinity, max: -Infinity });
        if (ep.episode < season.min)
            season.min = ep.episode;
        if (ep.episode + 1 > season.max)
            season.max = ep.episode + 1;
    }
    return seasons;
}
function alignEpisodeX(_a, seasonXOffset, seasonsInfo, seasonMaxInfo) {
    var episode = _a.episode, season = _a.season;
    var s = seasonsInfo[season];
    var maxs = seasonMaxInfo[season];
    var t = qd["align"];
    if (t === undefined) {
        return seasonXOffset[season] + (episode - s.min) / (s.max - s.min) * (maxs.max - maxs.min) + maxs.min;
    }
    else if (t === "season") {
        return seasonXOffset[season] + episode;
    }
    else if (t === "episode") {
        return seasonsInfo.slice(season).reduce(function (sum, x) { return sum + x.max - x.min; }, 0) + episode;
    }
    else if (t === "global") {
    }
}
function showChart(series) {
    currentDisplay = series;
    if (series.length === 0)
        return;
    var title = series.map(function (s) { return s[1].title; }).join(", ");
    var seasons = series.map(function (s) { return seriesToSeasons(s[1]); });
    // max bounds for each season
    var maxSeasons = [];
    var _loop_1 = function (i) {
        var data = seasons.map(function (s) { return s[i]; }).filter(function (s) { return s !== undefined; });
        if (data.length === 0)
            maxSeasons[i] = { min: 0, max: 0 };
        else
            maxSeasons[i] = { min: Math.min.apply(Math, data.map(function (i) { return i.min; })), max: Math.max.apply(Math, data.map(function (i) { return i.max; })) };
    };
    for (var i = 0; i < Math.max.apply(Math, seasons.map(function (s) { return s.length; })); i++) {
        _loop_1(i);
    }
    var seasonXOffset = [0];
    for (var i = 1; i < maxSeasons.length; i++) {
        seasonXOffset[i] = seasonXOffset[i - 1] + (maxSeasons[i - 1].max - maxSeasons[i - 1].min);
    }
    var plotBands = maxSeasons.map(function (season, i) { return ({
        from: seasonXOffset[i] + season.min, to: seasonXOffset[i] + season.max,
        label: { text: "Season " + i }
    }); });
    var plotLines = [];
    for (var i = 0; i < maxSeasons.length; i++) {
        var season = maxSeasons[i];
        if (season.min === season.max)
            continue;
        plotLines.push({
            value: seasonXOffset[i] + season.min - 0.5, width: 1, color: "black",
        });
    }
    var chartSeries = series.map(function (_a, si) {
        var i = _a[0], s = _a[1];
        return ({
            name: s.title,
            type: { "undefined": "scatter", "bar": "column", "scatter": "scatter", "line": "line" }["" + qd["d"]],
            marker: {
                enabled: true, radius: 5
            },
            color: colors[si],
            data: s.episodes.map(function (episode) {
                return {
                    name: episodeString(episode),
                    x: alignEpisodeX(episode, seasonXOffset, seasons[si], maxSeasons),
                    y: episode.rating / 10,
                    episode: episode
                };
            })
        });
    });
    if (qd["seriesTrend"] !== undefined)
        for (var i = 0; i < series.length; i++) {
            chartSeries.push({
                name: chartSeries[i].name + " – Trendline",
                marker: { enabled: false },
                dashStyle: 'shortdot',
                data: linearRegression(chartSeries[i].data),
                color: chartSeries[i].color,
            });
        }
    if (qd["noSeasonTrend"] === undefined) {
        for (var s_1 = 0; s_1 < series.length; s_1++) {
            var regData = [];
            var data = chartSeries[s_1].data;
            var season = data[0].episode.season, begin = 0;
            for (var i = 0; i < data.length; i++) {
                var curSeason = data[i].episode.season;
                if (curSeason != season) {
                    regData.push.apply(regData, linearRegression(data.slice(begin, i)));
                    // add gaps
                    regData.push({ x: regData[regData.length - 1].x + 0.1, y: null });
                    season = curSeason;
                    begin = i;
                }
            }
            regData.push.apply(regData, linearRegression(data.slice(begin)));
            chartSeries.push({
                name: chartSeries[s_1].name + " – Trendline",
                marker: { enabled: false },
                dashStyle: 'shortdot',
                data: regData,
                color: chartSeries[s_1].color
            });
        }
    }
    var xAxis = {
        //categories: series.episodes.map(tooltip),
        plotBands: plotBands,
        plotLines: plotLines,
        labels: { enabled: false },
        tickLength: 0,
        minorTickLength: 0
    };
    if (!chart) {
        chart = $("#chartContainer").highcharts({
            title: { text: title },
            chart: {
                zoomType: 'x'
            },
            xAxis: xAxis,
            yAxis: {
                max: 10,
                min: qd["noCutoff"] !== undefined ? 0 : undefined,
                title: { text: "Rating" },
                tickInterval: 1,
            },
            tooltip: {
                formatter: function () {
                    if (!this.point.episode)
                        return undefined;
                    return this.series.name + " <em>" + episodeString(this.point.episode) + "</em> : " + this.point.y.toFixed(1);
                }
            },
            series: chartSeries,
            credits: { enabled: false }
        }).highcharts();
    }
    else {
        chart.setTitle({ text: title });
        while (chart.series.length > 0)
            chart.series[0].remove(false);
        chart.xAxis[0].remove(false);
        chart.addAxis(xAxis, true, false);
        chart.colorCounter = 0;
        chart.symbolCounter = 0;
        chartSeries.forEach(function (c) { return chart.addSeries(c, false); });
        chart.redraw();
    }
    qd["t"] = series.map(function (_a) {
        var i = _a[0], s = _a[1];
        return (s.title + " " + s.year).replace(/ /g, "_");
    }).join("+");
    updateQueryString();
}
function seriesToAutocomplete(series, inx) {
    var txt = series.title + " (" + series.year + ")";
    return { optionHTML: txt, tokenHTML: txt, value: inx };
}
{
    var builder_1 = ProtoBuf.loadJson(_schema).build("imdbproto");
    getArrayBuffer("basedata-popular.buf.js", function (baseData) {
        database = builder_1.DB.decode(baseData);
        autoComplete = new AutoComplete("search", {
            placeholderHTML: "Search for TV series...",
            lists: { series: {
                    options: database.series.map(seriesToAutocomplete),
                    //optionHTML: (s:Series) => s.title,
                    //tokenHTML: x => "a"
                    matchOptions: function (inp, res) { return res.slice(0, 20).filter(function (v) { return !currentDisplay.some(function (_a) {
                        var i = _a[0], s = _a[1];
                        return i === v.value;
                    }); }); },
                } },
            onChange: function (val) { return showChart(val.map(function (v) { return [v[0].value, database.series[v[0].value]]; })); }
        });
        if (qd["t"])
            tryShowInitialChart();
        getArrayBuffer("basedata-unpopular.buf.js", function (baseData2) {
            var db2 = builder_1.DB.decode(baseData2);
            for (var _i = 0, _a = db2.series; _i < _a.length; _i++) {
                var series = _a[_i];
                var inx = database.series.push(series) - 1;
                autoComplete.addOption("series", seriesToAutocomplete(series, inx));
            }
            if (qd["t"] && !renderSuccess)
                tryShowInitialChart();
        });
    });
}
//# sourceMappingURL=render.js.map