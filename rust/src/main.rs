#![feature(nll)]

extern crate csv;
extern crate prost;
extern crate serde;
extern crate serde_json;
#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate prost_derive;
extern crate bytes;
extern crate indicatif;
extern crate itertools;
extern crate sha2;
use bytes::BytesMut;
use itertools::Itertools;
use prost::Message;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::prelude::*;
use std::io::{self, BufReader};
use std::path::Path;

mod tsvs;
use tsvs::*;
const dirname: &str = "../data";

mod ratings {
    include!(concat!(env!("OUT_DIR"), "/imdbproto.rs"));
}

struct Config {
    pub filter: fn(x: &ratings::db::Series) -> bool,
    pub outputFilename: String,
}
const minEpisodes: usize = 3;
const minVotes: i32 = 30;
const popularVotes: i32 = 20000;

fn load(fname: &str) -> Result<csv::Reader<std::fs::File>, csv::Error> {
    csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .quote(b'\t')
        .from_path(Path::new(dirname).join(fname))
}

fn load_series() -> Result<Vec<ratings::db::Series>, Box<Error>> {
    let mut series_map: HashMap<String, ratings::db::Series> = HashMap::new();
    let mut episodes_map: HashMap<String, ratings::db::series::Episode> = HashMap::new();
    let mut basics = load("title.basics.tsv")?;
    eprintln!("Loading basics");
    // let progress = indicatif::ProgressBar::new(6_000_000); large slowdown when using progress bar...
    for l in basics.deserialize() {
        let data: title_basics = l?;
        match data.titleType.as_ref() {
            "tvSeries" | "tvMiniSeries" => {
                let mut ser = ratings::db::Series {
                    title: data.primaryTitle,
                    distribution: 0,
                    episodes: vec![],
                    rating: 0,
                    votes: 0,
                    year: 0,
                };
                series_map.insert(data.tconst, ser);
            }
            "tvEpisode" => {
                let mut ep = ratings::db::series::Episode {
                    title: String::from(""), //data.primaryTitle,
                    distribution: 0,
                    season: 0,
                    episode: 0,
                    rating: 0,
                    votes: 0,
                };
                episodes_map.insert(data.tconst, ep);
            }
            _ => {}
        }
    }
    eprintln!("Loading ratings");

    let mut ratings = load("title.ratings.tsv")?;
    for l in ratings.deserialize() {
        let data: title_ratings = l?;
        let rating = (data.averageRating * 10.0).round() as i32;
        if let Some(episode) = episodes_map.get_mut(&data.tconst) {
            episode.rating = rating;
            episode.votes = data.numVotes;
        } else if let Some(series) = series_map.get_mut(&data.tconst) {
            series.rating = rating;
            series.votes = data.numVotes;
        } else {
            // eprintln!("Warning: could not find title {}", data.tconst);
        }
    }

    eprintln!("Loading episodes");
    let mut episodes = load("title.episode.tsv")?;
    for l in episodes.deserialize() {
        let data: title_episode = l?;
        if let (Some(series), Some(mut episode)) = (
            series_map.get_mut(&data.parentTconst),
            episodes_map.remove(&data.tconst),
        ) {
            episode.episode = data.episodeNumber.unwrap_or(0);
            episode.season = data.seasonNumber.unwrap_or(0);

            series.episodes.push(episode);
        } else {
            eprintln!(
                "Warning: could not find series {} episode {} S{}E{}",
                data.parentTconst,
                data.tconst,
                data.seasonNumber.unwrap_or(0),
                data.episodeNumber.unwrap_or(0)
            );
        }
    }

    Ok(series_map
        .into_iter()
        .map(|(k, v): (String, ratings::db::Series)| v)
        .collect())
}

fn write_with_config(
    series: impl Iterator<Item = ratings::db::Series>,
    config: &Config,
) -> Result<(), Box<Error>> {
    let db = ratings::Db {
        series: series
            .filter(|e| (config.filter)(e))
            .map(|s| s.clone())
            .collect(),
    };
    let len = db.encoded_len();
    println!("len will be: {} kB", len / 1000);
    let mut x = BytesMut::with_capacity(len);
    db.encode(&mut x);
    let mut f = File::create(&config.outputFilename)?;
    f.write_all(&x[..])?;
    Ok(())
}
fn hashn(s: &str) -> u8 {
    let res = Sha256::digest(s.as_bytes());
    res[0]
}
fn my_main() -> Result<(), Box<Error>> {
    let mut all_series: Vec<_> = load_series()?
        .into_iter()
        .map(|s| (hashn(&s.title), s))
        .collect();
    all_series.sort_by_key(|(hashstart, _)| *hashstart);

    for (hash_start, series) in &all_series.into_iter().group_by(|(hashstart, _)| *hashstart) {
        let config = Config {
            filter: |_| true,
            outputFilename: format!("data/{:02x}.buf", hash_start),
        };
        write_with_config(series.map(|(_, s)| s), &config)?;
    }
    Ok(())
}

fn main() {
    my_main().unwrap();
}
