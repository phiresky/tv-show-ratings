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
    console.log("showing initial chart");
    var series = qd["t"].replace(/_/g, " ").split("+").map(function (info) {
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
            seasons[a].to = inx;
            if (!seasons[b.season])
                seasons[b.season] = { from: 0, to: 0 };
            seasons[b.season].from = inx;
        }
        return b.season;
    }, 0);
    seasons[seasons.length - 1].to = allEps.length;
    var plotBands = seasons.map(function (season, i) { return ({
        from: season.from, to: season.to,
        label: { text: "Season " + i }
    }); });
    var plotLines = [];
    for (var _i = 0, seasons_1 = seasons; _i < seasons_1.length; _i++) {
        var season = seasons_1[_i];
        if (!season)
            continue;
        plotLines.push({ value: season.from + 0.5, width: 1, color: "black" });
        plotLines.push({ value: season.to + 0.5, width: 1, color: "black" });
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
        tooltip: {
            formatter: function () { return this.series.name + " <em>" + episodeString(this.point.episode) + "</em>"; }
        },
        series: series.map(function (s) { return ({
            name: s.title,
            //lineWidth: 0,
            marker: {
                enabled: true, radius: 5
            },
            data: s.episodes.map(function (episode, i) { return ({ name: episodeString(episode), x: episode.episode + seasons[episode.season].from, y: episode.rating / 10, episode: episode }); })
        }); })
    });
    qd["t"] = series.map(function (s) { return (s.title + " " + s.year).replace(/ /g, "_"); }).join(" ");
    updateQueryString();
}
function seriesToAutocomplete(series, inx) {
    return { optionHTML: series.title + " (" + series.year + ")", value: inx };
}
{
    var builder_1 = ProtoBuf.loadJson(_schema).build("imdbproto");
    getArrayBuffer("basedata-popular.buf.js", function (baseData) {
        database = builder_1.DB.decode(baseData);
        var comp = new AutoComplete("search", {
            placeholderHTML: "Search for TV series...",
            lists: { series: {
                    options: database.series.map(seriesToAutocomplete),
                } },
            onChange: function (val) { return showChart(val.map(function (v) { return database.series[v[0].value]; })); }
        });
        if (qd["t"])
            tryShowInitialChart();
        getArrayBuffer("basedata-unpopular.buf.js", function (baseData2) {
            var db2 = builder_1.DB.decode(baseData2);
            for (var _i = 0, _a = db2.series; _i < _a.length; _i++) {
                var series = _a[_i];
                var inx = database.series.push(series) - 1;
                comp.addOption("series", seriesToAutocomplete(series, inx));
            }
            if (qd["t"] && !renderSuccess)
                tryShowInitialChart();
        });
    });
}
//# sourceMappingURL=render.js.map