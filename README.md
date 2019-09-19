# tv-show-ratings

![screenshot](screenshot.png)

[Hosted Version](https://phiresky.github.io/tv-show-ratings/)

This project plots the episode ratings of TV shows and their trends.

## Prerequisites

You will need a ![recent Rust version](https://www.rust-lang.org/learn/get-started) and [yarn](https://yarnpkg.com).

```sh
$ rustc --version
1.37.0.
rustc 1.37.0 (eae3437df 2019-08-13)
```

## Local Setup

To parse / convert the data:

```sh
yarn
cd parse-data-rs
./getdata.sh
cargo run --release
cd ..
yarn run ts-node --transpile-only src/seed
```

To run the project first run `yarn run proto-gen` then run `yarn run dev`.

To build the production version run `yarn run build`.
