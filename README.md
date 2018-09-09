# tv-show-ratings

![screenshot](screenshot.png)

[Hosted Version](https://phiresky.github.io/tv-show-ratings/)

This project plots the episode ratings of TV shows and their trends.

To parse / convert the data use `cd parse-data-rs && ./getdata.sh && cargo run --release`.

To run the project first run `yarn && yarn run proto-gen` then run `yarn run dev`.

To build the production version run `yarn run build`.
