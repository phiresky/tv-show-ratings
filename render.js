function getArrayBuffer(filename, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", filename, true);
    oReq.responseType = "arraybuffer";
    oReq.onload = function (ev) {
        return callback(oReq.response);
    };
    oReq.send();
}
var qd = {};
location.search.substr(1).split("&").forEach(function (item) {
    var _a = item.split("="), k = _a[0], v = _a[1];
    if (k)
        qd[k] = v && decodeURIComponent(v);
});
function updateQueryString() {
    history.replaceState({}, "", "?" + $.param(qd));
}
window.ProtoBuf = dcodeIO.ProtoBuf;
var renderSuccess = false;
var database;
function getSeries(title, year) {
    for (var _i = 0, _a = database.series; _i < _a.length; _i++) {
        var series = _a[_i];
        if (series.title === title && series.year === year)
            return series;
    }
}
function episodeString(ep) {
    var s = ep.season, e = ep.episode;
    return "S" + (s < 10 ? '0' + s : s) + " E" + (e < 10 ? '0' + e : e);
}
function tooltip(ep) {
    return "<em>" + episodeString(ep) + "</em>";
}
function tryShowInitialChart() {
    var series = qd["t"].replace(/_/g, " ").split("~").map(function (info) {
        var inx = info.lastIndexOf(" ");
        var title = info.substr(0, inx);
        var year = +info.substr(inx + 1);
        return getSeries(title, year);
    });
    if (series.every(function (s) { return s !== undefined; })) {
        renderSuccess = true;
        showChart(series);
    }
}
function showChart(series) {
    if (series.length === 0)
        return;
    var title = series.map(function (s) { return s.title; }).join(", ");
    var allEps = [].concat.apply([], series.map(function (s) { return s.episodes; }));
    allEps.sort(function (a, b) { return a.season - b.season || a.episode - b.episode; });
    allEps = allEps.filter(function (ep, i) { return i == 0 || ep.season != allEps[i - 1].season || ep.episode != allEps[i - 1].episode; });
    var seasons = [{ from: 0, to: 0 }];
    allEps.reduce(function (a, b, inx) {
        if (a !== b.season) {
            seasons[a].to = inx - 1;
            if (!seasons[b.season])
                seasons[b.season] = { from: 0, to: 0 };
            seasons[b.season].from = inx;
        }
        return b.season;
    }, 0);
    var plotBands = allEps.reduce(function (things, episode, inx) {
        if (!things[0] || things[0].season != episode.season)
            things.unshift({ season: episode.season,
                from: inx, to: inx,
                label: { text: "Season " + episode.season } });
        else
            things[0].to = inx;
        return things;
    }, []);
    var plotLines = [];
    for (var _i = 0, plotBands_1 = plotBands; _i < plotBands_1.length; _i++) {
        var band = plotBands_1[_i];
        plotLines.push({ value: band.from - 0.5, width: 1, color: "black" });
        plotLines.push({ value: band.to + 0.5, width: 1, color: "black" });
    }
    $("#chartContainer").highcharts({
        title: { text: title },
        xAxis: {
            //categories: series.episodes.map(tooltip),
            plotBands: plotBands,
            plotLines: plotLines,
            type: 'category'
        },
        yAxis: {
            title: { text: "Rating" },
        },
        legend: {},
        tooltip: {
            formatter: function () { return tooltip(this.point.episode); }
        },
        series: series.map(function (s) { return ({
            name: s.title,
            lineWidth: 0,
            marker: {
                enabled: true, radius: 5
            },
            data: s.episodes.map(function (episode, i) { return ({ name: episodeString(episode), x: episode.episode + seasons[episode.season].from, y: episode.rating / 10, episode: episode }); })
        }); })
    });
    qd["t"] = series.map(function (s) { return (s.title + " " + s.year).replace(/ /g, "_"); }).join("~");
    updateQueryString();
}
ProtoBuf.loadJson(_schema, function (err, gBuilder) {
    if (err)
        throw err;
    var builder = gBuilder.build("imdbproto");
    getArrayBuffer("basedata-popular.buf.js", function (baseData) {
        database = builder.DB.decode(baseData);
        new AutoComplete("search", {
            placeholderHTML: "Search for TV series...",
            lists: { series: {
                    options: database.series.map(function (series, inx) { return ({ optionHTML: series.title + " (" + series.year + ")", value: inx }); }),
                } },
            onChange: function (val) { return showChart(val.map(function (v) { return database.series[v[0].value]; })); }
        });
        if (qd["t"])
            tryShowInitialChart();
    });
});
//# sourceMappingURL=render.js.map