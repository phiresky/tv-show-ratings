#!/usr/bin/env node
var ProtoBuf = require("protobufjs");
var builder = ProtoBuf.loadJsonFile("bin/ratings.json").build("imdbproto");
var fs = require('fs');
var minEpisodes = 3, minVotes = 30, popularVotes = 2000;
var baseConfig = {
    inFile: "data/ratings-series.list",
    outFile: "bin/basedata-popular.buf",
    filter: function (series) {
        return series.votes >= popularVotes && series.episodes.length >= minEpisodes;
    },
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
};
var transformLine = function (db, config) {
    return function (target, line) {
        // format: '      0000001223     329   8.5  "Elementary" (2012) {A Controlled Descent (#3.24)}'
        line = line.substr(6);
        var match = line.match(/^([*.0-9]{10})\s+(\d+)\s+(\d+\.\d)\s+"([^"]+)" \((\d{4}|\?{4})(?:\/(I|II|III|IV|V|VI|VII))?\)(?: \{(.*)\})?$/);
        if (match === null)
            throw Error("could not parse " + line);
        var distribution = match[1], votes = match[2], avg = match[3], series = match[4], year = match[5], roman_num = match[6], episodeInfo = match[7];
        if (roman_num)
            series += " " + roman_num;
        var distributionInt = +distribution.replace('.', '0').replace('*', '9');
        if (episodeInfo === undefined) {
            // is new series
            //console.log(`after ${target && target.episodes.length} episodes, new series starts: "${series}"`);
            target = new builder.DB.Series();
            target.title = series;
            target.distribution = distributionInt;
            if (year !== "????")
                target.year = +year;
            target.rating = +avg * 10;
            target.votes = +votes;
            db.series.push(target);
        }
        else {
            if (series !== target.title) {
                /*if(+votes > 50)
                    console.warn(`Warning: series != ${target.title} in '${line}'`);
                // it's missing because there are less than 5 votes for IMDb*/
                return target;
            }
            var episode = new builder.DB.Series.Episode();
            var _a = episodeInfo.match(/^(.*?)(?: ?\(#(\d+)\.(\d+)\))?$/), title = _a[1], season = _a[2], episodeNum = _a[3];
            episode.title = title;
            episode.rating = +avg * 10;
            episode.distribution = distributionInt;
            episode.votes = +votes;
            if (season !== undefined)
                episode.season = +season;
            if (episodeNum !== undefined)
                episode.episode = +episodeNum;
            target.episodes.push(episode);
        }
        return target;
    };
};
function applyShow(show, obj) {
    for (var attr in show)
        if (!show[attr])
            obj[attr] = null;
}
function parseDB(config) {
    var lines = fs.readFileSync(config.inFile, "utf8").split("\n");
    lines.pop();
    var db = new builder.DB();
    lines.reduce(transformLine(db, baseConfig), null);
    db.series = db.series.filter(config.filter);
    db.series.sort(function (a, b) { return b.votes - a.votes; });
    for (var _i = 0, _a = db.series; _i < _a.length; _i++) {
        var series = _a[_i];
        applyShow(config.show.series, series);
        series.episodes.sort(function (a, b) { return a.season - b.season || a.episode - b.episode; });
        for (var _b = 0, _c = series.episodes; _b < _c.length; _b++) {
            var episode = _c[_b];
            applyShow(config.show.episode, episode);
        }
    }
    var buf = db.encode().toBuffer();
    fs.writeFileSync(config.outFile, buf);
    console.log("wrote " + db.series.length + " series (" + buf.length / 1000 + " kB) to " + config.outFile);
}
parseDB(baseConfig);
baseConfig.outFile = "bin/basedata-unpopular.buf";
baseConfig.filter = function (series) {
    return series.votes > minVotes && series.votes < popularVotes && series.episodes.length >= minEpisodes;
};
parseDB(baseConfig);
baseConfig.outFile = "bin/additionalData.buf";
var s = baseConfig.show;
for (var key in s)
    s[key] = !s[key];
baseConfig.filter = function (series) {
    return series.votes > minVotes && series.episodes.length >= minEpisodes;
};
parseDB(baseConfig);
//# sourceMappingURL=parse.js.map