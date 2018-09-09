mkdir -p data-in
for f in title.basics.tsv.gz title.episode.tsv.gz title.ratings.tsv.gz; do
    wget https://datasets.imdbws.com/$f -O data-in/$f
    gunzip data-in/$f
done