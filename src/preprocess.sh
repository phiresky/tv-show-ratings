iconv -f ISO-8859-1 -t utf8 data/ratings.list -o data/ratings-series.list

# only series (title is in "")
sed -r -i '/[0-9]\.[0-9]  ".*" \(/!d' data/ratings-series.list
