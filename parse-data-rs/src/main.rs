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
use std::path::Path;

mod tsvs;
use tsvs::*;
const DIRNAME: &str = "../data";

mod ratings {
    include!(concat!(env!("OUT_DIR"), "/imdbproto.rs"));
}

const MIN_EPISODES: usize = 5;
const MIN_VOTES: i32 = 30;

fn load(fname: &str) -> Result<csv::Reader<std::fs::File>, csv::Error> {
    csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .quote(b'\t')
        .from_path(Path::new(DIRNAME).join(fname))
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
                let ser = ratings::db::Series {
                    title: data.primaryTitle,
                    distribution: 0,
                    episodes: vec![],
                    rating: 0,
                    votes: 0,
                    start_year: data.startYear.unwrap_or(0),
                    end_year: data.endYear.unwrap_or(0),
                };
                series_map.insert(data.tconst, ser);
            }
            "tvEpisode" => {
                let ep = ratings::db::series::Episode {
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
            if let (Some(episode_num), Some(season)) = (data.episodeNumber, data.seasonNumber) {
                episode.episode = episode_num;
                episode.season = season;

                series.episodes.push(episode);
            }
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
    eprintln!("Sorting episodes");
    for (_, series) in series_map.iter_mut() {
        series.episodes.retain(|e| e.rating != 0);
        series
            .episodes
            .sort_by(|a, b| a.season.cmp(&b.season).then(a.episode.cmp(&b.episode)));
    }

    Ok(series_map
        .into_iter()
        .map(|(_, v): (String, ratings::db::Series)| v)
        .collect())
}

fn write_with_config(
    series: impl Iterator<Item = ratings::db::Series>,
    out_path: &str,
) -> Result<(), Box<Error>> {
    let db = ratings::Db {
        series: series
            .map(|s| s.clone())
            .collect(),
    };
    let len = db.encoded_len();
    println!("len will be: {} kB", len / 1000);
    let mut x = BytesMut::with_capacity(len);
    db.encode(&mut x)?;
    let mut f = File::create(out_path)?;
    f.write_all(&x[..])?;
    Ok(())
}
// must be same as typescript
fn series_key(s: &ratings::db::Series) -> String {
    format!(
        "{} ({}-{})",
        s.title,
        if s.start_year == 0 {
            " ".to_owned()
        } else {
            format!("{}", s.start_year)
        },
        if s.end_year == 0 {
            " ".to_owned()
        } else {
            format!("{}", s.end_year)
        }
    )
}
fn hashn(s: &ratings::db::Series) -> u8 {
    let res = Sha256::digest(series_key(s).as_bytes());
    res[0]
}
fn my_main() -> Result<(), Box<Error>> {
    let mut all_series: Vec<_> = load_series()?
        .into_iter()
        .filter(|s| s.episodes.len() > MIN_EPISODES && s.votes > MIN_VOTES)
        .map(|s| (hashn(&s), s))
        .collect();
    all_series.sort_by_key(|(hashstart, _)| *hashstart);

    let file = File::create("data/titles.json")?;
    serde_json::to_writer(
        file,
        &all_series
            .iter()
            .map(|(_, s)| series_key(s))
            .collect::<Vec<_>>(),
    )?;

    for (hash_start, series) in &all_series.into_iter().group_by(|(hashstart, _)| *hashstart) {
        write_with_config(series.map(|(_, s)| s), &format!("data/{:02x}.buf", hash_start))?;
    }
    Ok(())
}

fn main() {
    my_main().unwrap();
}
