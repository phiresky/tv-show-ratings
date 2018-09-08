//#!/usr/bin/env node

import * as ProtoBuf from "protobufjs";
import { readFile, writeFile } from "mz/fs";
import * as readline from "readline";

const minEpisodes = 3,
    minVotes = 30,
    popularVotes = 2000;
const baseConfig = {
    inDir: "data",
    outFile: "bin/basedata-popular.buf.js",
    filter: (series: imdbproto.DB.Series) =>
        series.votes >= popularVotes && series.episodes.length >= minEpisodes,
    show: {
        series: {
            title: true,
            year: true,
            rating: true,
            votes: true,
            distribution: false
        },
        episode: {
            rating: true,
            season: true,
            episode: true,
            title: false,
            votes: false,
            distribution: false
        }
    }
};
function applyShow(show: any, obj: any) {
    for (const attr in show) if (!show[attr]) obj[attr] = null;
}
namespace IData {
    /** Contains the following information for titles: */
    export interface title_basics_tsv_gz {
        /** (string) - alphanumeric unique identifier of the title*/
        tconst: string;
        /** (string) – the type/format of the title (e.g. movie, short, tvseries, tvepisode, video, etc)*/
        titleType: string;
        /** (string) – the more popular title / the title used by the filmmakers on promotional materials at the point of release*/
        primaryTitle: string;
        /** (string) - original title, in the original language*/
        originalTitle: string;
        /** (boolean) - 0: non-adult title; 1: adult title.*/
        isAdult: string;
        /** (YYYY) – represents the release year of a title. In the case of TV Series, it is the series start year.*/
        startYear: string;
        /** (YYYY) – TV Series end year. ‘\N’ for all other title types*/
        endYear: string;
        /** – primary runtime of the title, in minutes*/
        runtimeMinutes: string;
        /** (string array) – includes up to three genres associated with the title*/
        genres: string;
    }

    /** Contains the director and writer information for all the titles in IMDb. Fields include:*/
    export interface title_crew_tsv_gz {
        /** (string) */
        tconst: string;
        /** (array of nconsts) - director(s) of the given title */
        directors: string;
        /** (array of nconsts) – writer(s) of the given title */
        writers: string;
    }

    /** Contains the tv episode information. Fields include:*/
    export interface title_episode_tsv_gz {
        /** (string) - alphanumeric identifier of episode */
        tconst: string;
        /** (string) - alphanumeric identifier of the parent TV Series */
        parentTconst: string;
        /** (integer) – season number the episode belongs to */
        seasonNumber: string;
        /** (integer) – episode number of the tconst in the TV series. */
        episodeNumber: string;
    }

    /** Contains the principal cast/crew for titles*/
    export interface title_principals_tsv_gz {
        /** (string) */
        tconst: string;
        /** (array of nconsts) – title’s top-billed cast/crew */
        principalCast: string;
    }

    /** Contains the IMDb rating and votes information for titles*/
    export interface title_ratings_tsv_gz {
        /** (string) */
        tconst: string;
        /** – weighted average of all the individual user ratings */
        averageRating: string;
        /** - number of votes the title has received */
        numVotes: string;
    }

    /** Contains the following information for names:*/
    export interface name_basics_tsv_gz {
        /** (string) - alphanumeric unique identifier of the name/person */
        nconst: string;
        /** (string)– name by which the person is most often credited */
        primaryName: string;
        /** – in YYYY format */
        birthYear: string;
        /** – in YYYY format if applicable, else ‘\N’ */
        deathYear: string;
        /** (array of strings)– the top-3 professions of the person */
        primaryProfession: string;
        /** (array of tconsts) – titles the person is known for */
        knownForTitles: string;
    }
}

function parseTsv<T>(filename: string, onRow: (data: T) => void): Promise<void> {
    console.log("parse", filename);
    return new Promise(resolve => {
        const dataOut: T[] = [];
        const reader = readline.createInterface({
            input: require("fs").createReadStream(filename)
        });
        let isHeader = true;
        let headers: string[];
        reader.on("line", line => {
            reader.pause();
            if (isHeader) {
                isHeader = false;
                headers = line.split("\t");
            }
            const ele: any = {};
            for (const [i, field] of line.split("\t").entries()) {
                ele[headers[i]] = field;
            }
            onRow(ele);
            reader.resume();
        });
        reader.on("close", () => resolve());
    });
}

async function parseDB(config: typeof baseConfig) {
    const series = new Map<string, imdbproto.DB.Series>();
    const episodes = new Map<string, imdbproto.DB.Series.Episode>();
    await parseTsv<IData.title_basics_tsv_gz>(config.inDir + "/title.basics.tsv", title => {
        if (title.titleType === "tvSeries" || title.titleType === "tvMiniSeries") {
            series.set(title.tconst, {
                //title: title.
                episodes: []
            });
        } else if (title.titleType === "tvEpisode") {
            episodes.set(title.tconst, {
                title: title.originalTitle
            });
        }
    });
    await parseTsv<IData.title_episode_tsv_gz>(config.inDir + "/title.episode.tsv", ep => {
        const serie = series.get(ep.parentTconst);
        const episode = episodes.get(ep.tconst);
        if (!serie) return console.warn("no parent", ep);
        if (!episode) return console.warn("no ep");
        episode.season = +ep.seasonNumber;
        episode.episode = +ep.episodeNumber;
        serie.episodes.push(episode);
        //episode.rating = +ep.
    });
    const ratings = await parseTsv<IData.title_ratings_tsv_gz>(
        config.inDir + "/title.ratings.tsv",
        ep => {
            const episode = episodes.get(ep.tconst);
            if (episode) {
                episode.rating = +ep.averageRating;
                episode.votes = +ep.numVotes;
            }
        }
    );
    const builder = await ProtoBuf.load("src/ratings.proto");

    const db = builder.lookupType("imdbproto.DB");
    const data: imdbproto.DB = { series: [...series.values()] };
    data.series.sort((a, b) => b.votes! - a.votes!);
    data.series = data.series.filter(config.filter);
    for (const series of data.series) {
        applyShow(config.show.series, series);
        series.episodes.sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
        for (const episode of series.episodes) applyShow(config.show.episode, episode);
    }
    const msg = db.create(data);
    const buf = db.encode(msg).finish();
    await writeFile(config.outFile, buf as any);
    console.log(`wrote ${data.series.length} series (${buf.length / 1000} kB) to ${config.outFile}`);
}
async function doIt() {
    await parseDB(baseConfig);

    baseConfig.outFile = "bin/basedata-unpopular.buf.js";
    baseConfig.filter = series =>
        series.votes > minVotes &&
        series.votes < popularVotes &&
        series.episodes.length >= minEpisodes;
    await parseDB(baseConfig);

    baseConfig.outFile = "bin/additionalData.buf.js";
    const s = baseConfig.show as any;
    for (const key in s) s[key] = !s[key];
    baseConfig.filter = series => series.votes > minVotes && series.episodes.length >= minEpisodes;
    await parseDB(baseConfig);
}
doIt();
