for f in title.basics.tsv.gz title.episode.tsv.gz title.ratings.tsv.gz; do
    wget https://datasets.imdbws.com/$f -O data/$f
    gunzip data/$f
done