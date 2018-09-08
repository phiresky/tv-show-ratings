use serde;
use serde::{Deserialize, Deserializer};
use std;
use std::error::Error;

pub fn nullable<'de, D, T>(de: D) -> std::result::Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    Option<T>: Deserialize<'de>,
    T: std::str::FromStr,
    <T as std::str::FromStr>::Err: std::fmt::Debug,
{
    String::deserialize(de).and_then(|s| match s.as_ref() {
        "\\N" => Ok(None),
        other => other.parse::<T>().map(|p| Some(p)).map_err(|e| {
            serde::de::Error::invalid_value(
                serde::de::Unexpected::Other(&format!("{:?}", e)),
                &"int",
            )
        }),
    })
}

#[derive(Debug, Deserialize)]
pub struct title_basics {
    /** (string) - alphanumeric unique identifier of the title*/
    pub tconst: String,
    /** (string) – the type/format of the title (e.g. movie, short, tvseries, tvepisode, video, etc)*/
    pub titleType: String,
    /** (string) – the more popular title / the title used by the filmmakers on promotional materials at the point of release*/
    pub primaryTitle: String,
    /** (string) - original title, in the original language*/
    pub originalTitle: String,
    /** (boolean) - 0: non-adult title; 1: adult title.*/
    pub isAdult: i32,
    /** (YYYY) – represents the release year of a title. In the case of TV Series, it is the series start year.*/
    #[serde(deserialize_with = "nullable")]
    pub startYear: Option<i32>,
    /** (YYYY) – TV Series end year. ‘\N’ for all other title types*/
    #[serde(deserialize_with = "nullable")]
    pub endYear: Option<i32>,
    /** – primary runtime of the title, in minutes*/
    #[serde(deserialize_with = "nullable")]
    pub runtimeMinutes: Option<i32>,
    /** (string array) – includes up to three genres associated with the title*/
    pub genres: String,
}

/** Contains the director and writer information for all the titles in IMDb. Fields include:*/
#[derive(Debug, Deserialize)]
pub struct title_crew {
    /** (string) */
    pub tconst: String,
    /** (array of nconsts) - director(s) of the given title */
    pub directors: String,
    /** (array of nconsts) – writer(s) of the given title */
    pub writers: String,
}

/** Contains the tv episode information. Fields include:*/
#[derive(Debug, Deserialize)]
pub struct title_episode {
    /** (string) - alphanumeric identifier of episode */
    pub tconst: String,
    /** (string) - alphanumeric identifier of the parent TV Series */
    pub parentTconst: String,
    /** (integer) – season number the episode belongs to */
    #[serde(deserialize_with = "nullable")]
    pub seasonNumber: Option<i32>,
    /** (integer) – episode number of the tconst in the TV series. */
    #[serde(deserialize_with = "nullable")]
    pub episodeNumber: Option<i32>,
}

/** Contains the principal cast/crew for titles*/
#[derive(Debug, Deserialize)]
pub struct title_principals {
    /** (string) */
    pub tconst: String,
    /** (array of nconsts) – title’s top-billed cast/crew */
    pub principalCast: String,
}

/** Contains the IMDb rating and votes information for titles*/
#[derive(Debug, Deserialize)]
pub struct title_ratings {
    /** (string) */
    pub tconst: String,
    /** – weighted average of all the individual user ratings */
    pub averageRating: f32,
    /** - number of votes the title has received */
    pub numVotes: i32,
}

/** Contains the following information for names:*/
#[derive(Debug, Deserialize)]
pub struct name_basics {
    /** (string) - alphanumeric unique identifier of the name/person */
    pub nconst: String,
    /** (string)– name by which the person is most often credited */
    pub primaryName: String,
    /** – in YYYY format */
    pub birthYear: String,
    /** – in YYYY format if applicable, else ‘\N’ */
    pub deathYear: String,
    /** (array of strings)– the top-3 professions of the person */
    pub primaryProfession: String,
    /** (array of tconsts) – titles the person is known for */
    pub knownForTitles: String,
}
